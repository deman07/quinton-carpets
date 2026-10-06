/**
 * Which time windows are already full.
 *
 * This is what the calendar greys out. It is a courtesy, not the
 * rule: two people can look at the same free window at once, so the
 * booking insert checks the count again under a lock (see
 * src/pages/api/bookings.ts) and that is the check that counts.
 */

import { db, hasDatabase } from "./db.ts";
import { getSettings } from "./catalogue.ts";
import { slotKey, type FullSlots, type SlotKey } from "../dates.ts";

/** How many measures a window takes, from the settings table. */
export async function capacityFor(slot: string): Promise<number> {
  const { capacity } = await getSettings();
  return capacity[slot as SlotKey] ?? 0;
}

/** Full windows between two dates, inclusive. */
export async function fullSlots(from: string, to: string): Promise<FullSlots> {
  // No database means nothing is booked. The page still renders.
  if (!hasDatabase()) return new Set();

  try {
    const { capacity } = await getSettings();
    const { results } = await db
      .prepare(
        `SELECT date, slot, count(*)::int AS n FROM bookings
          WHERE date >= ?1 AND date <= ?2
          GROUP BY date, slot`,
      )
      .bind(from, to)
      .all<{ date: string; slot: SlotKey; n: number }>();

    const full = new Set<string>();
    for (const r of results) {
      if (r.n >= (capacity[r.slot] ?? 0)) full.add(slotKey(r.date, r.slot));
    }

    // A window the shop has closed (capacity 0) is full on every day,
    // booked or not.
    const closed = (Object.keys(capacity) as SlotKey[]).filter((k) => capacity[k] <= 0);
    if (closed.length) {
      for (let d = from; d <= to; d = nextDay(d)) {
        for (const k of closed) full.add(slotKey(d, k));
      }
    }
    return full;
  } catch (err) {
    // A database having a bad moment should not take the booking page
    // down with it. Every window shows as open, and the insert still
    // refuses one that is full.
    console.error("could not read availability", err);
    return new Set();
  }
}

const nextDay = (iso: string) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};
