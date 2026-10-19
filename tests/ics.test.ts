import { describe, it, expect } from "vitest";
import { calendar, londonTime } from "../src/lib/ics.ts";

describe("London time to UTC", () => {
  it("is an hour behind in summer", () => {
    expect(londonTime("2026-07-14", 10).toISOString()).toBe("2026-07-14T09:00:00.000Z");
  });

  it("is the same in winter", () => {
    expect(londonTime("2026-12-01", 10).toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });

  it("is right on the days the clocks change", () => {
    // Clocks go back at 2am on 25 October 2026, forward on 29 March 2026.
    expect(londonTime("2026-10-25", 10).toISOString()).toBe("2026-10-25T10:00:00.000Z");
    expect(londonTime("2026-03-29", 10).toISOString()).toBe("2026-03-29T09:00:00.000Z");
  });
});

describe("calendar files", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const ics = calendar(
    [
      {
        uid: "QC-1910-7T4M@quintoncarpets.co.uk",
        date: "2026-10-22",
        slot: "am",
        summary: "Free measure, Quinton Carpets",
        description: "Line one\nLine two; with a semicolon",
        location: "12 Ridgacre Road, B32 2TJ",
      },
    ],
    {},
    now,
  );

  it("uses CRLF line endings and the window's times", () => {
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261022T090000Z");
    expect(ics).toContain("DTEND:20261022T120000Z");
  });

  it("escapes commas, semicolons and newlines", () => {
    expect(ics).toContain(String.raw`SUMMARY:Free measure\, Quinton Carpets`);
    expect(ics).toContain(String.raw`Line one\nLine two\; with a semicolon`);
  });

  it("folds long lines at 75 octets", () => {
    const long = calendar([{ uid: "x", date: "2026-10-22", slot: "pm", summary: "£".repeat(80) }], {}, now);
    for (const line of long.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("marks a cancelled visit as cancelled, so calendars remove it", () => {
    const c = calendar([{ uid: "x", date: "2026-10-22", slot: "eve", summary: "x", cancelled: true }], { method: "CANCEL" }, now);
    expect(c).toContain("METHOD:CANCEL");
    expect(c).toContain("STATUS:CANCELLED");
  });
});
