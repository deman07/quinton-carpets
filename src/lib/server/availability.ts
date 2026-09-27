/**
 * Which time windows are already full.
 *
 * This is what the calendar greys out. It is a courtesy, not the
 * rule: two people can look at the same free window at once, so the
 * booking insert checks the count again under a lock (see
 * src/pages/api/bookings.ts) and that is the check that counts.
 */

import { db, hasDatabase } from "./db.ts";
import { SLOT_CAPACITY, slotKey, type FullSlots } from "../dates.ts";

/** Full windows between two dates, inclusive. */
export async function fullSlots(from: string, to: string): Promise<FullSlots> {
  // No database means nothing is booked. The page still renders.
  if (!hasDatabase()) return new Set();

  try {
    const { results } = await db
      .prepare(
        `SELECT date, slot FROM bookings
          WHERE date >= ?1 AND date <= ?2
          GROUP BY date, slot
         HAVING count(*) >= ?3`,
      )
      .bind(from, to, SLOT_CAPACITY)
      .all<{ date: string; slot: string }>();
    return new Set(results.map((r) => slotKey(r.date, r.slot)));
  } catch (err) {
    // A database having a bad moment should not take the booking page
    // down with it. Every window shows as open, and the insert still
    // refuses one that is full.
    console.error("could not read availability", err);
    return new Set();
  }
}
