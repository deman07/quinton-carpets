import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  SAMPLE_BOOKING,
  confirmationEmail,
  cancelledEmail,
  rescheduledEmail,
  esc,
  type TemplateName,
} from "../src/lib/email-templates.ts";

const ctx = { siteUrl: "https://www.quintoncarpets.co.uk" };

describe("every email", () => {
  for (const name of Object.keys(TEMPLATES) as TemplateName[]) {
    const mail = TEMPLATES[name].render(ctx, SAMPLE_BOOKING);

    it(`${name}: has a subject, HTML and a plain-text copy`, () => {
      expect(mail.subject.length).toBeGreaterThan(10);
      expect(mail.html).toMatch(/^<!doctype html>/);
      expect(mail.text).toContain("QUINTON CARPETS");
    });

    it(`${name}: carries the reference, in both versions`, () => {
      expect(mail.html).toContain(SAMPLE_BOOKING.ref);
      expect(mail.text).toContain(SAMPLE_BOOKING.ref);
    });

    it(`${name}: never asks for money on the website`, () => {
      const t = mail.text.toLowerCase();
      for (const word of ["pay now", "card number", "deposit", "checkout"]) expect(t).not.toContain(word);
    });

    it(`${name}: links only to the shop's own site, the phone or the map`, () => {
      const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!);
      for (const h of hrefs) {
        expect(h, h).toMatch(/^(https:\/\/www\.quintoncarpets\.co\.uk\/|tel:|https:\/\/fonts\.googleapis\.com\/)/);
      }
    });
  }
});

describe("what each one says", () => {
  it("the confirmation has the window, the address, a link to the booking and their code", () => {
    const m = confirmationEmail(ctx, SAMPLE_BOOKING);
    expect(m.text).toMatch(/Thursday,? 22 October 2026/);
    expect(m.text).toContain("Morning (10am – 1pm)");
    expect(m.text).toContain("12 Ridgacre Road, B32 2TJ");
    expect(m.text).toContain("https://www.quintoncarpets.co.uk/booking/QC-1910-7T4M/");
    expect(m.text).toContain("QC-REF-9WQE");
  });

  it("the moved email gives both the old and the new time", () => {
    const m = rescheduledEmail(ctx, SAMPLE_BOOKING, { date: "2026-10-21", slot: "pm" });
    expect(m.text).toMatch(/Wednesday,? 21 October 2026 · Afternoon \(1pm – 4pm\)/);
    expect(m.subject).toMatch(/Thursday,? 22 October 2026/);
  });

  it("the cancellation strikes the reference through and offers to book again", () => {
    const m = cancelledEmail(ctx, SAMPLE_BOOKING);
    expect(m.html).toContain("line-through");
    expect(m.text).toContain("/book/");
  });

  it("a trailing slash on the site URL does not double up", () => {
    const m = confirmationEmail({ siteUrl: "https://www.quintoncarpets.co.uk/" }, SAMPLE_BOOKING);
    expect(m.html).not.toContain("co.uk//");
  });
});

describe("escaping", () => {
  it("whatever a customer types is shown, never run", () => {
    const m = confirmationEmail(ctx, { ...SAMPLE_BOOKING, name: `<script>alert(1)</script> "Pat"`, address: `<img src=x onerror=1>` });
    expect(m.html).not.toContain("<script>alert");
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("escapes quotes, so nothing breaks out of an attribute", () => {
    expect(esc(`" onmouseover='x'`)).toBe("&quot; onmouseover=&#39;x&#39;");
  });
});
