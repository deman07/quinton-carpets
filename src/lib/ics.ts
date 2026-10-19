/**
 * Calendar files (RFC 5545), for the "add to calendar" attachment on
 * the customer's emails and the staff diary feed.
 *
 * Times are written in UTC. A window is "10am – 1pm" in Birmingham,
 * whichever side of the clocks changing it falls, so each one is
 * turned from London time into UTC here rather than leaving a
 * calendar app to guess the timezone.
 */

import { TZ, type SlotKey } from "./dates.ts";

/** Start and end of each window, London time, 24-hour. */
export const SLOT_HOURS: Record<SlotKey, [number, number]> = {
  am: [10, 13],
  pm: [13, 16],
  eve: [16, 18],
};

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The UTC instant at which it is `hour`:00 on `iso` in London. */
export function londonTime(iso: string, hour: number): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  // Start by pretending London is UTC, see how far out that is, and
  // correct by the difference. London is never more than an hour off.
  const guess = Date.UTC(y, m - 1, d, hour);
  const p = Object.fromEntries(partsFmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return new Date(guess - (shown - guess));
}

/** 20261019T090000Z */
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Commas, semicolons and backslashes are escaped; newlines become \n. */
const text = (s: string) =>
  String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded, as the standard requires. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  let first = true;
  while (new TextEncoder().encode(rest).length > (first ? 75 : 74)) {
    let cut = first ? 75 : 74;
    // Never split a multi-byte character.
    while (new TextEncoder().encode(rest.slice(0, cut)).length > (first ? 75 : 74)) cut--;
    out.push((first ? "" : " ") + rest.slice(0, cut));
    rest = rest.slice(cut);
    first = false;
  }
  out.push((first ? "" : " ") + rest);
  return out.join("\r\n");
}

export interface CalendarEvent {
  uid: string;
  date: string;
  slot: SlotKey;
  summary: string;
  description?: string;
  location?: string;
  /** A cancelled booking is sent as a cancellation, so calendars remove it. */
  cancelled?: boolean;
  /** Bumped on every change, so calendars take the newer copy. */
  sequence?: number;
  url?: string;
}

function vevent(e: CalendarEvent, now: Date): string[] {
  const [from, to] = SLOT_HOURS[e.slot];
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(londonTime(e.date, from))}`,
    `DTEND:${stamp(londonTime(e.date, to))}`,
    `SUMMARY:${text(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${text(e.description)}`] : []),
    ...(e.location ? [`LOCATION:${text(e.location)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    `SEQUENCE:${e.sequence ?? 0}`,
    `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
  ];
}

export function calendar(
  events: CalendarEvent[],
  opts: { name?: string; method?: "PUBLISH" | "CANCEL" } = {},
  now: Date = new Date(),
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Quinton Carpets//Diary//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    ...(opts.name ? [`X-WR-CALNAME:${text(opts.name)}`, `NAME:${text(opts.name)}`] : []),
    "X-WR-TIMEZONE:Europe/London",
    ...events.flatMap((e) => vevent(e, now)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
