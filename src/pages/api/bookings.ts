/**
 * POST /api/bookings , the only endpoint that writes a booking.
 *
 * No payment is taken here or anywhere else on the site. This
 * stores a request for a free measure, tells the shop about it, and
 * that is all.
 */

import type { APIRoute } from "astro";
import { json, clientIp, rateLimit, after } from "../../lib/server/env.ts";
import { db } from "../../lib/server/db.ts";
import { validateBooking } from "../../lib/server/validate.ts";
import { sendBookingEmails } from "../../lib/server/email.ts";
import { mintBookingRef, mintReferralCode } from "../../lib/codes.ts";
import { slotKey } from "../../lib/dates.ts";
import { capacityFor } from "../../lib/server/availability.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const now = new Date();
  const wantsJson = (request.headers.get("accept") ?? "").includes("application/json");

  // Accept both a JSON fetch and a plain form post, so the page
  // still works if the island never loads.
  let raw: Record<string, unknown>;
  try {
    const type = request.headers.get("content-type") ?? "";
    raw = type.includes("application/json")
      ? ((await request.json()) as Record<string, unknown>)
      : (Object.fromEntries(await request.formData()) as Record<string, unknown>);
  } catch {
    return json({ error: "We couldn't read that form. Please try again." }, 400);
  }

  const ip = clientIp(request);
  if (!(await rateLimit(ip, 8, now))) {
    return json(
      { error: "That's a few too many bookings from here. Please ring the shop on 0121 423 3322." },
      429,
    );
  }

  const check = validateBooking(raw, now);
  if (!check.ok) {
    return json({ error: check.error, field: check.field }, 400);
  }
  const b = check.value;

  // The shop can close a window altogether by setting its capacity to 0.
  const capacity = await capacityFor(b.slot);
  if (capacity <= 0) {
    return json(
      { error: "We're not booking measures in that window at the moment. Please pick another.", slotFull: true },
      409,
    );
  }

  // A reference collision is vanishingly unlikely, but the column is
  // a primary key, so try again rather than fail the customer.
  //
  // The window's capacity is checked in the same transaction as the
  // insert, under a lock on that date and window. Without the lock,
  // two people booking the last place at the same moment would each
  // count one booking, and both would get in.
  let ref = "";
  let referralCode = "";
  let saved = false;
  for (let attempt = 0; attempt < 5 && !saved; attempt++) {
    ref = mintBookingRef(now);
    referralCode = mintReferralCode();
    let rows: Record<string, unknown>[][];
    try {
      rows = await db.batch([
        db.prepare(`SELECT pg_advisory_xact_lock(hashtext(?1))`).bind(
          `booking:${slotKey(b.date, b.slot)}`,
        ),
        db.prepare(
          `INSERT INTO bookings
             (ref, name, phone, email, address, postcode, estimate_code,
              referred_by, date, slot, notes, created_at, status)
           SELECT ?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,'new'
            WHERE (SELECT count(*) FROM bookings
                    WHERE date = ?9 AND slot = ?10 AND status <> 'cancelled') < ?13
           RETURNING ref`,
        ).bind(
          ref,
          b.name,
          b.phone,
          b.email,
          b.address,
          b.postcode,
          b.estimate ?? null,
          b.referral ?? null,
          b.date,
          b.slot,
          b.notes ?? null,
          now.toISOString(),
          capacity,
        ),
        // Written only if the booking above was, so a full window
        // leaves nothing behind.
        db.prepare(
          `INSERT INTO referral_codes (code, owner_ref, redemptions, created_at)
           SELECT ?1, ref, 0, ?3 FROM bookings WHERE ref = ?2`,
        ).bind(referralCode, ref, now.toISOString()),
      ]);
    } catch (err) {
      if (attempt === 4) {
        console.error("booking insert failed", err);
        return json(
          { error: "We couldn't save that booking. Please ring the shop on 0121 423 3322." },
          500,
        );
      }
      continue;
    }

    if (!rows[1]?.length) {
      return json(
        {
          error: "Someone has just taken the last place in that window. Please pick another.",
          slotFull: true,
        },
        409,
      );
    }
    saved = true;
  }

  // A friend's code being used is recorded here. Whether the reward
  // is actually earned is decided by the shop when the job is paid,
  // never by the site.
  if (b.referral) {
    after(
      db.prepare(`UPDATE referral_codes SET redemptions = redemptions + 1 WHERE code = ?1`)
        .bind(b.referral)
        .run()
        .catch((e: unknown) => console.error("referral count failed", e)),
    );
  }

  // The booking is saved. Email is best-effort from here , a mail
  // provider having a bad morning must never lose someone's slot.
  after(
    sendBookingEmails({ ...b, ref, referralCode }).then((rs) =>
      rs.forEach((r) => {
        if (!r.sent) console.warn("email not sent:", r.reason);
      }),
    ),
  );

  // A no-JavaScript post gets sent to its own booking page.
  if (!wantsJson) {
    return new Response(null, { status: 303, headers: { location: `/booking/${ref}/` } });
  }
  return json({ ref, referralCode });
};

/** Anything else here is a mistake, and says so plainly. */
export const ALL: APIRoute = () =>
  json({ error: "Send a booking with POST." }, 405, { allow: "POST" });
