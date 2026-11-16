/**
 * GET /api/calendar/<token>.ics , the diary as a calendar feed.
 *
 * Calendar apps cannot log in, so the feed is unlocked by a long
 * random token that belongs to one member of staff (see the Staff
 * page). It stops working the moment their account is switched off
 * or they make a new link. The URL is the password: treat it like one.
 *
 * Bookings from a fortnight ago to the end of the diary, cancelled
 * ones included so the calendar removes them.
 */

import type { APIRoute } from "astro";
import { db } from "../../../lib/server/db.ts";
import { calendar, type CalendarEvent } from "../../../lib/ics.ts";
import { addDaysISO, slotLabel, todayISO, type SlotKey } from "../../../lib/dates.ts";
import { getSettings } from "../../../lib/server/catalogue.ts";

export const prerender = false;

const notFound = () => new Response("Not found.", { status: 404, headers: { "cache-control": "no-store" } });

export const GET: APIRoute = async ({ params }) => {
  const token = String(params.token ?? "").replace(/\.ics$/, "");
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return notFound();

  const staff = await db
    .prepare(`SELECT id FROM staff WHERE calendar_token = ?1 AND active`)
    .bind(token)
    .first<{ id: number }>();
  if (!staff) return notFound();

  const from = addDaysISO(todayISO(), -14);
  const { results } = await db
    .prepare(
      `SELECT ref, name, phone, address, postcode, date, slot, status, notes, staff_notes, updated_at, created_at
         FROM bookings WHERE date >= ?1 ORDER BY date, slot LIMIT 2000`,
    )
    .bind(from)
    .all<{
      ref: string; name: string; phone: string; address: string; postcode: string; date: string;
      slot: SlotKey; status: string; notes: string | null; staff_notes: string | null;
      updated_at: string | null; created_at: string;
    }>();

  const site = (await getSettings()).siteUrl.replace(/\/$/, "");
  const events: CalendarEvent[] = results.map((b) => ({
    uid: `${b.ref}@diary.quintoncarpets.co.uk`,
    date: b.date,
    slot: b.slot,
    summary: `${b.status === "cancelled" ? "CANCELLED · " : ""}Measure · ${b.name} · ${b.postcode}`,
    location: `${b.address}, ${b.postcode}`,
    description: [
      `${b.ref} · ${slotLabel(b.slot)} · ${b.status}`,
      `Phone: ${b.phone}`,
      b.notes ? `Their note: ${b.notes}` : "",
      b.staff_notes ? `Shop notes: ${b.staff_notes}` : "",
      `${site}/admin/?q=${b.ref}`,
    ]
      .filter(Boolean)
      .join("\n"),
    cancelled: b.status === "cancelled",
    sequence: Math.max(0, Math.floor(Date.parse(b.updated_at ?? b.created_at) / 1000) - 1_700_000_000),
  }));

  return new Response(calendar(events, { name: "Quinton Carpets , measures" }), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
};
