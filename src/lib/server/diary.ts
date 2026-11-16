/**
 * Changes staff make to a booking in the diary.
 *
 * Every change is written together with a line in booking_events ,
 * who, when, what , in one transaction, so the history on each
 * booking is never missing a step. Emails to the customer go after
 * the change is saved and never undo it.
 */

import { db, type Statement } from "./db.ts";
import { capacityFor } from "./availability.ts";
import { after } from "./env.ts";
import { sendCancelled, sendRescheduled, sendThanks, sendConfirmation, type Sent } from "./email.ts";
import { dayOfWeek, longDate, parseISO, slotKey, slotLabel, todayISO, SLOTS, type SlotKey } from "../dates.ts";
import type { Staff } from "./auth.ts";
import type { BookingData } from "../email-templates.ts";

export const STATUSES = ["new", "called", "measured", "fitted", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];
/** What the status dropdown offers. Cancelling is its own button. */
export const OPEN_STATUSES = ["new", "called", "measured", "fitted"] as const;

export interface BookingRow extends BookingData {
  status: Status;
  staff_notes: string | null;
  reward_earned: number | null;
}

export async function getBooking(ref: string): Promise<BookingRow | null> {
  return db
    .prepare(
      `SELECT b.ref, b.name, b.phone, b.email, b.address, b.postcode, b.date, b.slot, b.notes,
              b.estimate_code AS estimate, b.referred_by AS referral, b.status, b.staff_notes,
              r.code AS "referralCode",
              (SELECT reward_earned FROM referral_codes WHERE code = b.referred_by) AS reward_earned
         FROM bookings b LEFT JOIN referral_codes r ON r.owner_ref = b.ref
        WHERE b.ref = ?1`,
    )
    .bind(ref)
    .first<BookingRow>();
}

const event = (ref: string, actor: string, what: string, now: Date) =>
  db
    .prepare(`INSERT INTO booking_events (ref, at, actor, what) VALUES (?1, ?2, ?3, ?4)`)
    .bind(ref, now.toISOString(), actor, what);

const touch = (ref: string, now: Date) =>
  db.prepare(`UPDATE bookings SET updated_at = ?2 WHERE ref = ?1`).bind(ref, now.toISOString());

/** Logs an email going out, or not, against the booking. Never throws. */
export function logEmail(ref: string, actor: string, label: string, p: Promise<Sent>): void {
  after(
    p.then((r) =>
      event(ref, actor, r.sent ? `Emailed: ${label}` : `Email not sent (${label}): ${r.reason.slice(0, 160)}`, new Date()).run(),
    ),
  );
}

export type Action =
  | { action: "status"; status: string; notify?: boolean }
  | { action: "notes"; notes: string }
  | { action: "reschedule"; date: string; slot: string; notify?: boolean; overbook?: boolean }
  | { action: "cancel"; notify?: boolean; reason?: string }
  | { action: "reinstate"; overbook?: boolean }
  | { action: "reward"; earned: boolean }
  | { action: "resend" }
  | { action: "thanks" };

export type Outcome =
  | { ok: true; booking: BookingRow; message: string }
  | { ok: false; status: number; error: string; full?: boolean };

const fail = (status: number, error: string, full = false): Outcome => ({ ok: false, status, error, full });

/**
 * Takes a place in a window, under the same lock the public booking
 * form uses, so a member of staff and a customer cannot both take the
 * last place. Returns the rows of the guarded UPDATE: empty means full.
 */
async function intoWindow(
  ref: string,
  date: string,
  slot: SlotKey,
  set: string,
  extra: unknown[],
  overbook: boolean,
  follow: Statement[],
): Promise<boolean> {
  const capacity = await capacityFor(slot);
  const rows = await db.batch([
    db.prepare(`SELECT pg_advisory_xact_lock(hashtext(?1))`).bind(`booking:${slotKey(date, slot)}`),
    db
      .prepare(
        `UPDATE bookings SET ${set}
          WHERE ref = ?1
            AND (?4::boolean OR (SELECT count(*) FROM bookings
                                  WHERE date = ?2 AND slot = ?3 AND status <> 'cancelled' AND ref <> ?1) < ?5)
        RETURNING ref`,
      )
      .bind(ref, date, slot, overbook, capacity, ...extra),
    // Only written if the update was, by checking it took effect.
    ...follow,
  ]);
  return (rows[1]?.length ?? 0) > 0;
}

export async function applyAction(ref: string, a: Action, staff: Staff, now = new Date()): Promise<Outcome> {
  const before = await getBooking(ref);
  if (!before) return fail(404, "There's no booking with that reference.");
  const who = staff.name;
  const iso = now.toISOString();

  switch (a.action) {
    case "status": {
      if (!(OPEN_STATUSES as readonly string[]).includes(a.status)) {
        return fail(400, `Status must be one of: ${OPEN_STATUSES.join(", ")}.`);
      }
      if (before.status === "cancelled") return fail(409, "Reinstate the booking before changing its status.");
      if (before.status === a.status) return { ok: true, booking: before, message: "No change." };
      await db.batch([
        db.prepare(`UPDATE bookings SET status = ?2, updated_at = ?3 WHERE ref = ?1`).bind(ref, a.status, iso),
        event(ref, who, `Status: ${before.status} → ${a.status}`, now),
      ]);
      const booking = (await getBooking(ref))!;
      if (a.status === "fitted" && a.notify) logEmail(ref, "site", "thank-you", sendThanks(booking));
      return { ok: true, booking, message: a.status === "fitted" && a.notify ? "Saved , thank-you email on its way." : "Saved." };
    }

    case "notes": {
      const notes = String(a.notes ?? "").trim().slice(0, 2000);
      if (notes === (before.staff_notes ?? "")) return { ok: true, booking: before, message: "No change." };
      await db.batch([
        db.prepare(`UPDATE bookings SET staff_notes = ?2, updated_at = ?3 WHERE ref = ?1`).bind(ref, notes || null, iso),
        event(ref, who, notes ? "Notes updated" : "Notes cleared", now),
      ]);
      return { ok: true, booking: (await getBooking(ref))!, message: "Notes saved." };
    }

    case "reschedule": {
      const date = String(a.date ?? "");
      const slot = String(a.slot ?? "") as SlotKey;
      if (!parseISO(date)) return fail(400, "Pick a date.");
      if (!SLOTS.some((s) => s.key === slot)) return fail(400, "Pick a window.");
      if (date < todayISO(now)) return fail(400, "That date has already gone.");
      if (dayOfWeek(date) === 0 && slot === "eve") return fail(400, "The shop shuts at 4pm on a Sunday , pick the morning or afternoon.");
      if (before.status === "cancelled") return fail(409, "Reinstate the booking before moving it.");
      if (date === before.date && slot === before.slot) return fail(400, "That's when it already is.");

      const what = `Moved from ${longDate(before.date)} ${slotLabel(before.slot)} to ${longDate(date)} ${slotLabel(slot)}${a.overbook ? " (overbooked)" : ""}`;
      const moved = await intoWindow(
        ref,
        date,
        slot,
        `date = ?2, slot = ?3, updated_at = ?6, reminded_at = NULL`,
        [iso],
        Boolean(a.overbook),
        [
          db
            .prepare(
              `INSERT INTO booking_events (ref, at, actor, what)
               SELECT ?1, ?2, ?3, ?4 FROM bookings WHERE ref = ?1 AND date = ?5 AND slot = ?6`,
            )
            .bind(ref, iso, who, what, date, slot),
        ],
      );
      if (!moved) return fail(409, `${longDate(date)}, ${slotLabel(slot)} is full. Tick "Overbook" to put it in anyway.`, true);

      const booking = (await getBooking(ref))!;
      if (a.notify) logEmail(ref, "site", "booking moved", sendRescheduled(booking, { date: before.date, slot: before.slot }));
      return { ok: true, booking, message: a.notify ? "Moved , the customer is being emailed." : "Moved." };
    }

    case "cancel": {
      if (before.status === "cancelled") return { ok: true, booking: before, message: "Already cancelled." };
      const reason = String(a.reason ?? "").trim().slice(0, 300);
      await db.batch([
        db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = ?2 WHERE ref = ?1`).bind(ref, iso),
        event(ref, who, `Cancelled (was ${before.status})${reason ? `: ${reason}` : ""}`, now),
      ]);
      const booking = (await getBooking(ref))!;
      if (a.notify) logEmail(ref, "site", "booking cancelled", sendCancelled(booking));
      return { ok: true, booking, message: a.notify ? "Cancelled , the customer is being emailed." : "Cancelled." };
    }

    case "reinstate": {
      if (before.status !== "cancelled") return fail(400, "It isn't cancelled.");
      const back = await intoWindow(
        ref,
        before.date,
        before.slot as SlotKey,
        `status = 'new', updated_at = ?6`,
        [iso],
        Boolean(a.overbook),
        [
          db
            .prepare(
              `INSERT INTO booking_events (ref, at, actor, what)
               SELECT ?1, ?2, ?3, ?4 FROM bookings WHERE ref = ?1 AND status = 'new'`,
            )
            .bind(ref, iso, who, `Reinstated${a.overbook ? " (overbooked)" : ""}`),
        ],
      );
      if (!back) return fail(409, `Its window has filled up since. Move it, or tick "Overbook".`, true);
      return { ok: true, booking: (await getBooking(ref))!, message: "Reinstated." };
    }

    case "reward": {
      if (!before.referral) return fail(400, "Nobody referred this booking.");
      await db.batch([
        db.prepare(`UPDATE referral_codes SET reward_earned = ?2 WHERE code = ?1`).bind(before.referral, a.earned ? 1 : 0),
        touch(ref, now),
        event(ref, who, a.earned ? `Referral reward earned for ${before.referral}` : `Referral reward withdrawn for ${before.referral}`, now),
      ]);
      return { ok: true, booking: (await getBooking(ref))!, message: "Saved." };
    }

    case "resend": {
      if (before.status === "cancelled") return fail(409, "It's cancelled , reinstate it first.");
      // Only the customer's copy: the shop already has its own.
      logEmail(ref, "site", "confirmation (resent)", sendConfirmation(before));
      await event(ref, who, "Asked for the confirmation to be sent again", now).run();
      return { ok: true, booking: before, message: "Sending it again." };
    }

    case "thanks": {
      if (before.status !== "fitted") return fail(409, "Mark it as fitted first.");
      logEmail(ref, "site", "thank-you", sendThanks(before));
      await event(ref, who, "Asked for the thank-you email to be sent", now).run();
      return { ok: true, booking: before, message: "Thank-you email on its way." };
    }

    default:
      return fail(400, "Unknown action.");
  }
}

// ------------------------------------------------------------------
// Reading the diary
// ------------------------------------------------------------------

export type View = "day" | "week" | "upcoming" | "past";

export interface Filter {
  view: View;
  /** The day shown, or the first day of the week. */
  date: string;
  /** Free text: name, phone, email, postcode, address or reference. */
  q: string;
  /** A status, "open" (anything not cancelled or fitted), or "" for all but cancelled. */
  status: string;
}

export interface DiaryRow {
  ref: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  estimate_code: string | null;
  referred_by: string | null;
  date: string;
  slot: string;
  notes: string | null;
  staff_notes: string | null;
  status: Status;
  created_at: string;
  updated_at: string | null;
  reminded_at: string | null;
  code: string | null;
  redemptions: number | null;
  reward_earned: number | null;
  est_input: unknown;
  est_result: unknown;
}

const addDays = (iso: string, n: number) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};

export const LIMIT = 300;

/** The bookings a filter picks out, in diary order. */
export async function listBookings(f: Filter, today: string): Promise<DiaryRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `?${params.length}`;
  };

  const q = f.q.trim();
  if (q) {
    // A search looks across every date; the view does not narrow it.
    const like = p(`%${q.replace(/[\%_]/g, (c) => `\${c}`)}%`);
    const digits = q.replace(/\D/g, "");
    const parts = [
      `b.ref ILIKE ${like}`,
      `b.name ILIKE ${like}`,
      `b.email ILIKE ${like}`,
      `b.address ILIKE ${like}`,
      `replace(b.postcode, ' ', '') ILIKE ${p(`%${q.replace(/\s/g, "")}%`)}`,
    ];
    if (digits.length >= 4) parts.push(`regexp_replace(b.phone, '\D', '', 'g') LIKE ${p(`%${digits}%`)}`);
    where.push(`(${parts.join(" OR ")})`);
  } else if (f.view === "day") {
    where.push(`b.date = ${p(f.date)}`);
  } else if (f.view === "week") {
    where.push(`b.date >= ${p(f.date)} AND b.date <= ${p(addDays(f.date, 6))}`);
  } else if (f.view === "upcoming") {
    where.push(`b.date >= ${p(today)}`);
  } else {
    where.push(`b.date < ${p(today)}`);
  }

  if (f.status === "open") where.push(`b.status IN ('new','called','measured')`);
  else if ((STATUSES as readonly string[]).includes(f.status)) where.push(`b.status = ${p(f.status)}`);
  else if (!q) where.push(`b.status <> 'cancelled'`);

  const order = f.view === "past" && !q ? "b.date DESC, b.slot DESC" : "b.date ASC, b.slot ASC, b.created_at ASC";

  const { results } = await db
    .prepare(
      `SELECT b.*, r.code, r.redemptions, e.input AS est_input, e.result AS est_result,
              (SELECT reward_earned FROM referral_codes WHERE code = b.referred_by) AS reward_earned
         FROM bookings b
         LEFT JOIN referral_codes r ON r.owner_ref = b.ref
         LEFT JOIN estimates e ON e.code = b.estimate_code
        WHERE ${where.join(" AND ")}
        ORDER BY ${order}
        LIMIT ${LIMIT}`,
    )
    .bind(...params)
    .all<DiaryRow>();
  return results;
}

export interface EventRow {
  ref: string;
  at: string;
  actor: string;
  what: string;
}

/** The history of each booking shown, oldest first. */
export async function eventsFor(refs: string[]): Promise<Map<string, EventRow[]>> {
  const out = new Map<string, EventRow[]>();
  if (!refs.length) return out;
  const { results } = await db
    .prepare(
      `SELECT ref, at, actor, what FROM booking_events
        WHERE ref = ANY(string_to_array(?1::text, ','))
        ORDER BY id`,
    )
    // References never contain a comma. (A JSON string here would be
    // encoded a second time by the driver.)
    .bind(refs.join(","))
    .all<EventRow>();
  for (const e of results) {
    const list = out.get(e.ref) ?? [];
    list.push(e);
    out.set(e.ref, list);
  }
  return out;
}

/** How many places are taken in each window on one day. */
export async function takenOn(date: string): Promise<Record<SlotKey, number>> {
  const { results } = await db
    .prepare(
      `SELECT slot, count(*)::int AS n FROM bookings
        WHERE date = ?1 AND status <> 'cancelled' GROUP BY slot`,
    )
    .bind(date)
    .all<{ slot: SlotKey; n: number }>();
  const taken: Record<SlotKey, number> = { am: 0, pm: 0, eve: 0 };
  for (const r of results) taken[r.slot] = Number(r.n);
  return taken;
}

/** Reads a filter out of the diary's query string, with safe defaults. */
export function readFilter(url: URL, today: string): Filter {
  const v = url.searchParams.get("view");
  const view: View = v === "week" || v === "upcoming" || v === "past" ? v : "day";
  const d = url.searchParams.get("date") ?? "";
  return {
    view,
    date: parseISO(d) ? d : today,
    q: (url.searchParams.get("q") ?? "").slice(0, 80),
    status: (url.searchParams.get("status") ?? "").slice(0, 20),
  };
}

export { addDays };
