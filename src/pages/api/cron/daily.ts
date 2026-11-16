/**
 * GET /api/cron/daily , run once a day by Vercel Cron (vercel.json).
 *
 *  1. Emails tomorrow's customers a reminder. Each booking is claimed
 *     (reminded_at set) before its email goes, so a retry or a second
 *     run never sends two.
 *  2. Clears out rate-limit rows and logins that have expired.
 *
 * It also means the database is used at least once a day, which on
 * Supabase's free plan helps stop the project being paused for being
 * idle.
 *
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET
 * is set on the project. Without the secret, nobody can run it.
 */

import type { APIRoute } from "astro";
import { timingSafeEqual } from "node:crypto";
import { db } from "../../../lib/server/db.ts";
import { json, getEnv } from "../../../lib/server/env.ts";
import { sendReminder } from "../../../lib/server/email.ts";
import { addDaysISO, todayISO } from "../../../lib/dates.ts";
import type { BookingData } from "../../../lib/email-templates.ts";

export const prerender = false;

function authorised(request: Request): boolean {
  const secret = getEnv().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export const GET: APIRoute = async ({ request }) => {
  if (!authorised(request)) return json({ error: "Not allowed." }, 401);

  const now = new Date();
  const tomorrow = addDaysISO(todayISO(now), 1);

  const { results: due } = await db
    .prepare(
      `UPDATE bookings SET reminded_at = ?2
        WHERE date = ?1 AND reminded_at IS NULL AND status IN ('new','called')
       RETURNING ref, name, phone, email, address, postcode, date, slot,
                 (SELECT code FROM referral_codes WHERE owner_ref = bookings.ref) AS "referralCode"`,
    )
    .bind(tomorrow, now.toISOString())
    .all<BookingData>();

  let sent = 0;
  const failed: string[] = [];
  for (const b of due) {
    const r = await sendReminder(b);
    if (r.sent) sent++;
    else {
      failed.push(b.ref);
      // Not sent, so the diary must not say it was.
      await db.prepare(`UPDATE bookings SET reminded_at = NULL WHERE ref = ?1`).bind(b.ref).run();
    }
    await db
      .prepare(`INSERT INTO booking_events (ref, at, actor, what) VALUES (?1, ?2, 'site', ?3)`)
      .bind(b.ref, new Date().toISOString(), r.sent ? "Emailed: day-before reminder" : `Reminder not sent: ${r.reason.slice(0, 160)}`)
      .run();
  }

  // Rate-limit buckets are per hour; nothing older than two days matters.
  const cutoff = new Date(now.getTime() - 2 * 86_400_000).toISOString();
  await db.prepare(`DELETE FROM rate_limit WHERE seen_at < ?1`).bind(cutoff).run();
  await db.prepare(`DELETE FROM staff_sessions WHERE expires_at < ?1`).bind(now.toISOString()).run();

  return json({ reminders: due.length, sent, failed });
};
