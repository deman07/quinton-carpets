/**
 * Every email the site sends, as data in and { subject, html, text }
 * out. Nothing here sends anything , see lib/server/email.ts , so the
 * templates can be tested, and previewed on /admin/emails/, without a
 * mail provider.
 *
 * Each email is a list of blocks, and the same list is drawn twice:
 * once as HTML and once as plain text. That keeps the two versions
 * saying the same thing, which spam filters and screen readers both
 * notice when they don't.
 *
 * The HTML is the kind mail clients still understand: tables for
 * layout, every style inline, nothing that needs JavaScript or a
 * stylesheet. It looks like the site , the yellow, the ink border, the
 * hard shadow , and still reads properly in Outlook, which ignores
 * most of that.
 */

import { BUSINESS } from "../data/business.ts";
import { longDate, slotLabel } from "./dates.ts";

// The site's colours, written out because email cannot use variables.
const C = {
  ground: "#F5F3EE",
  card: "#FFFFFF",
  ink: "#15120C",
  ink2: "#3E382D",
  muted: "#7C7466",
  line: "#DFDACE",
  yellow: "#FFC61A",
  yellowSoft: "#FFF4CC",
  ok: "#1F6B3A",
  okBg: "#E3F2E7",
  warn: "#8A4B00",
  warnBg: "#FFF0DB",
};

const SANS = "'Hanken Grotesk','Segoe UI',Helvetica,Arial,sans-serif";
const DISPLAY = "'Archivo','Arial Black','Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'DM Mono',ui-monospace,'SFMono-Regular',Menlo,Consolas,monospace";

export const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// ------------------------------------------------------------------
// Blocks
// ------------------------------------------------------------------

type Tone = "plain" | "yellow" | "ok" | "warn";

export type Block =
  | { kind: "eyebrow"; text: string }
  | { kind: "h1"; text: string }
  | { kind: "p"; text: string; muted?: boolean }
  | { kind: "ticket"; label: string; value: string; sub?: string; struck?: boolean }
  | { kind: "details"; rows: Array<[string, string]> }
  | { kind: "button"; label: string; href: string }
  | { kind: "steps"; title: string; items: Array<[string, string]> }
  | { kind: "callout"; title: string; body: string; code?: string; tone?: Tone }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "divider" };

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  plain: { bg: C.ground, fg: C.ink2, border: C.ink },
  yellow: { bg: C.yellowSoft, fg: C.ink, border: C.ink },
  ok: { bg: C.okBg, fg: C.ok, border: C.ok },
  warn: { bg: C.warnBg, fg: C.warn, border: C.warn },
};

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "eyebrow":
      return `<tr><td style="padding:0 0 10px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:22px;height:3px;background:${C.yellow};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding-left:10px;font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.muted}">${esc(b.text)}</td>
        </tr></table></td></tr>`;
    case "h1":
      return `<tr><td style="padding:0 0 14px;font-family:${DISPLAY};font-weight:800;font-size:26px;line-height:1.15;letter-spacing:-.02em;color:${C.ink}">${esc(b.text)}</td></tr>`;
    case "p":
      return `<tr><td style="padding:0 0 14px;font-family:${SANS};font-size:${b.muted ? 13 : 16}px;line-height:1.6;color:${b.muted ? C.muted : C.ink2}">${esc(b.text)}</td></tr>`;
    case "ticket":
      return `<tr><td style="padding:4px 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed ${C.ink};border-radius:12px;background:${C.ground}">
          <tr><td style="padding:16px 18px">
            <div style="font-family:${MONO};font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:${C.muted}">${esc(b.label)}</div>
            <div style="padding-top:4px;font-family:${MONO};font-size:26px;letter-spacing:.06em;color:${C.ink};${b.struck ? "text-decoration:line-through;" : ""}">${esc(b.value)}</div>
            ${b.sub ? `<div style="padding-top:6px;font-family:${SANS};font-size:14px;font-weight:700;color:${C.ink}">${esc(b.sub)}</div>` : ""}
          </td></tr>
        </table></td></tr>`;
    case "details":
      return `<tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${b.rows
          .map(
            ([k, v], i) => `<tr>
            <td valign="top" style="width:34%;padding:9px 12px 9px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${SANS};font-size:13px;color:${C.muted}">${esc(k)}</td>
            <td valign="top" style="padding:9px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink}">${esc(v)}</td>
          </tr>`,
          )
          .join("")}
        </table></td></tr>`;
    case "button":
      // A "bulletproof" button: a table cell with a link filling it,
      // so it is still a yellow block in Outlook.
      return `<tr><td style="padding:2px 0 22px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="background:${C.yellow};border:2px solid ${C.ink};border-radius:999px;box-shadow:4px 4px 0 ${C.ink}">
            <a href="${esc(b.href)}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:16px;font-weight:800;color:${C.ink};text-decoration:none">${esc(b.label)} &rarr;</a>
          </td>
        </tr></table></td></tr>`;
    case "steps":
      return `<tr><td style="padding:4px 0 10px;font-family:${DISPLAY};font-weight:800;font-size:17px;color:${C.ink}">${esc(b.title)}</td></tr>
        <tr><td style="padding:0 0 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${b.items
          .map(
            ([t, d], i) => `<tr>
            <td valign="top" style="width:38px;padding:0 0 12px">
              <div style="width:28px;height:28px;line-height:28px;border-radius:999px;background:${C.ink};color:${C.yellow};text-align:center;font-family:${MONO};font-size:13px">${i + 1}</div>
            </td>
            <td valign="top" style="padding:3px 0 12px;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ink2}"><strong style="color:${C.ink}">${esc(t)}</strong> ${esc(d)}</td>
          </tr>`,
          )
          .join("")}
        </table></td></tr>`;
    case "callout": {
      const t = TONES[b.tone ?? "yellow"];
      return `<tr><td style="padding:4px 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${t.bg};border:2px solid ${t.border};border-radius:12px">
          <tr><td style="padding:16px 18px">
            <div style="font-family:${SANS};font-size:15px;font-weight:800;color:${t.fg === C.ink2 ? C.ink : t.fg}">${esc(b.title)}</div>
            ${b.code ? `<div style="padding-top:6px;font-family:${MONO};font-size:24px;letter-spacing:.08em;color:${C.ink}">${esc(b.code)}</div>` : ""}
            <div style="padding-top:6px;font-family:${SANS};font-size:14px;line-height:1.55;color:${t.fg}">${esc(b.body)}</div>
          </td></tr>
        </table></td></tr>`;
    }
    case "list":
      return `<tr><td style="padding:4px 0 8px;font-family:${DISPLAY};font-weight:800;font-size:17px;color:${C.ink}">${esc(b.title)}</td></tr>
        <tr><td style="padding:0 0 16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${b.items
          .map(
            (it) => `<tr>
            <td valign="top" style="width:20px;padding:4px 0;font-family:${SANS};font-size:15px;color:${C.ink}">&#9679;</td>
            <td valign="top" style="padding:4px 0;font-family:${SANS};font-size:15px;line-height:1.5;color:${C.ink2}">${esc(it)}</td>
          </tr>`,
          )
          .join("")}
        </table></td></tr>`;
    case "divider":
      return `<tr><td style="padding:6px 0 20px"><div style="height:1px;background:${C.line};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
  }
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "eyebrow":
      return b.text.toUpperCase();
    case "h1":
      return `${b.text}\n${"=".repeat(Math.min(b.text.length, 60))}`;
    case "p":
      return b.text;
    case "ticket":
      return `${b.label}: ${b.value}${b.struck ? " (no longer booked)" : ""}${b.sub ? `\n${b.sub}` : ""}`;
    case "details":
      return b.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    case "button":
      return `${b.label}: ${b.href}`;
    case "steps":
      return `${b.title}\n${b.items.map(([t, d], i) => `${i + 1}. ${t} ${d}`).join("\n")}`;
    case "callout":
      return `${b.title}${b.code ? `\n${b.code}` : ""}\n${b.body}`;
    case "list":
      return `${b.title}\n${b.items.map((i) => `- ${i}`).join("\n")}`;
    case "divider":
      return "----";
  }
}

// ------------------------------------------------------------------
// The frame every email sits in
// ------------------------------------------------------------------

export interface Rendered {
  subject: string;
  html: string;
  text: string;
}

interface Frame {
  subject: string;
  /** The grey line a mail app shows after the subject. */
  preheader: string;
  blocks: Block[];
  siteUrl: string;
  /** Why they are getting it , the last line of the footer. */
  reason: string;
}

function render(f: Frame): Rendered {
  const body = f.blocks.map(blockHtml).join("\n");
  const site = f.siteUrl.replace(/\/$/, "");

  // The logo in the header is a PNG, because Gmail and Outlook do not
  // show SVG. Its gold roll would vanish on yellow, so the band is white
  // with a yellow rule under it; with images off, the alt text is set in
  // the wordmark's type.
  const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(f.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@800&family=DM+Mono&family=Hanken+Grotesk:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  @media (max-width:520px){ .pad{padding:22px 18px!important} .h-top{padding:16px 18px!important} }
  a{color:${C.ink}}
</style>
</head>
<body style="margin:0;padding:0;background:${C.ground};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.ground}">${esc(f.preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.ground}">
<tr><td align="center" style="padding:28px 12px 36px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">

    <tr><td class="h-top" style="background:${C.card};border:2px solid ${C.ink};border-bottom:4px solid ${C.yellow};border-radius:16px 16px 0 0;padding:18px 26px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:${DISPLAY};font-weight:800;font-size:19px;letter-spacing:-.01em;color:${C.ink}">
          <a href="${esc(site)}/" style="color:${C.ink};text-decoration:none"><img src="${esc(site)}/logo.png" width="200" height="27" alt="Quinton Carpets" style="display:block;border:0;width:200px;max-width:100%;height:auto"></a>
        </td>
        <td align="right" style="font-family:${MONO};font-size:11px;letter-spacing:.08em;color:${C.ink}">
          <a href="${esc(BUSINESS.phoneHref)}" style="color:${C.ink};text-decoration:none">${esc(BUSINESS.phone)}</a>
        </td>
      </tr></table>
    </td></tr>

    <tr><td class="pad" style="background:${C.card};border:2px solid ${C.ink};border-top:0;border-radius:0 0 16px 16px;padding:30px 30px 14px;box-shadow:6px 6px 0 ${C.ink}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${body}
      </table>
    </td></tr>

    <tr><td style="padding:26px 8px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted}">
      <strong style="color:${C.ink2}">${esc(BUSINESS.name)}</strong> · ${esc(BUSINESS.street)}, ${esc(BUSINESS.city)} ${esc(BUSINESS.postcode)}<br>
      Mon – Sat 10am – 6pm · Sunday 10am – 4pm ·
      <a href="${esc(BUSINESS.phoneHref)}" style="color:${C.muted}">${esc(BUSINESS.phone)}</a><br>
      Guide prices are confirmed on the free measure. Payment is only ever taken in the shop.<br>
      ${esc(f.reason)} <a href="${esc(site)}/privacy/" style="color:${C.muted}">How we look after your details</a>.
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "QUINTON CARPETS",
    "",
    ...f.blocks.map(blockText).flatMap((t) => [t, ""]),
    "--",
    `${BUSINESS.name}, ${BUSINESS.street}, ${BUSINESS.city} ${BUSINESS.postcode}`,
    `${BUSINESS.phone} · Mon – Sat 10am – 6pm · Sunday 10am – 4pm`,
    "Guide prices are confirmed on the free measure. Payment is only ever taken in the shop.",
    `${f.reason} Privacy: ${site}/privacy/`,
  ].join("\n");

  return { subject: f.subject, html, text };
}

// ------------------------------------------------------------------
// The emails
// ------------------------------------------------------------------

export interface BookingData {
  ref: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  postcode: string;
  date: string;
  slot: string;
  notes?: string | null;
  estimate?: string | null;
  referral?: string | null;
  referralCode?: string | null;
}

export interface Ctx {
  siteUrl: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const when = (b: Pick<BookingData, "date" | "slot">) => `${longDate(b.date)}`;
const bookingUrl = (ctx: Ctx, ref: string) => `${ctx.siteUrl.replace(/\/$/, "")}/booking/${ref}/`;
const REASON = "You're getting this because you booked a free measure with us.";
const ringLine = `Need to change anything? Ring ${BUSINESS.phone} with your reference , we'll sort it.`;

const referralCallout = (code: string): Block => ({
  kind: "callout",
  tone: "yellow",
  title: "Your referral code",
  code,
  body: "Give it to a friend. They get 5% off their fitting, and once their job is paid you get 20% off the fitting on your next order.",
});

/** To the customer, the moment they book. */
export function confirmationEmail(ctx: Ctx, b: BookingData): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: `Booked: your free measure on ${longDate(b.date)} (${b.ref})`,
    preheader: `${slotLabel(b.slot)} at ${b.address}. Nothing to pay , we'll ring to confirm within one working day.`,
    reason: REASON,
    blocks: [
      { kind: "eyebrow", text: "Free measure · booked" },
      { kind: "h1", text: `You're booked in, ${firstName(b.name)}.` },
      {
        kind: "p",
        text: "Thanks for choosing us. There's nothing to pay for the measure, and nothing to pay on the website at any point , you settle up in the shop once you've chosen.",
      },
      { kind: "ticket", label: "Your reference", value: b.ref, sub: `${when(b)} · ${slotLabel(b.slot)}` },
      {
        kind: "details",
        rows: [
          ["Where", `${b.address}, ${b.postcode}`],
          ["We'll ring", b.phone],
          ...(b.estimate ? ([["Your estimate", b.estimate]] as Array<[string, string]>) : []),
          ...(b.referral ? ([["Friend's code", `${b.referral} , 5% off your fitting`]] as Array<[string, string]>) : []),
        ],
      },
      { kind: "button", label: "View your booking", href: bookingUrl(ctx, b.ref) },
      {
        kind: "steps",
        title: "What happens next",
        items: [
          ["We ring you.", "Within one working day, to confirm the window and answer any questions."],
          ["We measure up.", "About twenty minutes, no obligation."],
          ["You choose in the shop.", "With the samples in your hand."],
        ],
      },
      ...(b.referralCode ? [referralCallout(b.referralCode)] : []),
      { kind: "p", text: `The calendar file attached adds the visit to your phone. ${ringLine}`, muted: true },
    ],
  });
}

/** To the shop, the moment someone books. Everything on one screen. */
export function shopNewBookingEmail(ctx: Ctx, b: BookingData): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: `${b.ref} , measure booked, ${longDate(b.date)}, ${slotLabel(b.slot)}`,
    preheader: `${b.name}, ${b.postcode} · ring ${b.phone}`,
    reason: "Sent to the shop for every booking made on the website.",
    blocks: [
      { kind: "eyebrow", text: "New booking" },
      { kind: "h1", text: `${b.name} wants a measure` },
      { kind: "ticket", label: "Reference", value: b.ref, sub: `${longDate(b.date)} · ${slotLabel(b.slot)}` },
      {
        kind: "details",
        rows: [
          ["Phone", b.phone],
          ["Email", b.email],
          ["Address", `${b.address}, ${b.postcode}`],
          ...(b.estimate ? ([["Estimate", b.estimate]] as Array<[string, string]>) : []),
          ...(b.referral ? ([["Referred by", `${b.referral} , 5% off their fitting`]] as Array<[string, string]>) : []),
          ...(b.referralCode ? ([["Their new code", b.referralCode]] as Array<[string, string]>) : []),
          ...(b.notes ? ([["Their notes", b.notes]] as Array<[string, string]>) : []),
        ],
      },
      { kind: "button", label: "Open in the diary", href: `${ctx.siteUrl.replace(/\/$/, "")}/admin/?q=${b.ref}` },
      { kind: "p", text: `Ring them back within one working day on ${b.phone}. Reply to this email to write to them.`, muted: true },
    ],
  });
}

/** To the customer, the afternoon before. */
export function reminderEmail(ctx: Ctx, b: BookingData): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: `Tomorrow: your free measure, ${slotLabel(b.slot)}`,
    preheader: `We'll see you at ${b.address} tomorrow. Reference ${b.ref}.`,
    reason: REASON,
    blocks: [
      { kind: "eyebrow", text: "See you tomorrow" },
      { kind: "h1", text: `We're with you tomorrow, ${firstName(b.name)}.` },
      { kind: "ticket", label: "Your reference", value: b.ref, sub: `${when(b)} · ${slotLabel(b.slot)}` },
      { kind: "details", rows: [["Where", `${b.address}, ${b.postcode}`]] },
      {
        kind: "list",
        title: "To make the most of it",
        items: [
          "Clear a path along the walls if you can , we measure edge to edge.",
          "Have a think about colours, or bring a cushion or paint chart to the shop later.",
          "Point out anything awkward: a door that catches, a step that's uneven, a radiator pipe.",
          "Nobody has to take a day off , it takes about twenty minutes.",
        ],
      },
      { kind: "button", label: "View your booking", href: bookingUrl(ctx, b.ref) },
      { kind: "p", text: `Can't make it after all? Ring ${BUSINESS.phone} and we'll find another time , no problem at all.`, muted: true },
    ],
  });
}

/** To the customer, when the shop moves their visit. */
export function rescheduledEmail(
  ctx: Ctx,
  b: BookingData,
  was: { date: string; slot: string },
): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: `Moved: your free measure is now ${longDate(b.date)}`,
    preheader: `New time: ${slotLabel(b.slot)}. Same reference, ${b.ref}.`,
    reason: REASON,
    blocks: [
      { kind: "eyebrow", text: "Booking moved" },
      { kind: "h1", text: `Your measure has a new time, ${firstName(b.name)}.` },
      { kind: "p", text: "As agreed, we've moved your free measure. Everything else stays the same." },
      { kind: "ticket", label: "New time", value: longDate(b.date), sub: slotLabel(b.slot) },
      {
        kind: "details",
        rows: [
          ["Was", `${longDate(was.date)} · ${slotLabel(was.slot)}`],
          ["Where", `${b.address}, ${b.postcode}`],
          ["Reference", b.ref],
        ],
      },
      { kind: "button", label: "View your booking", href: bookingUrl(ctx, b.ref) },
      { kind: "p", text: `The calendar file attached replaces the old one. ${ringLine}`, muted: true },
    ],
  });
}

/** To the customer, when a booking is cancelled. */
export function cancelledEmail(ctx: Ctx, b: BookingData): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: `Cancelled: your free measure on ${longDate(b.date)}`,
    preheader: `Reference ${b.ref} is cancelled. Book again any time , it's still free.`,
    reason: REASON,
    blocks: [
      { kind: "eyebrow", text: "Booking cancelled" },
      { kind: "h1", text: `Your measure is cancelled, ${firstName(b.name)}.` },
      { kind: "ticket", label: "Reference", value: b.ref, sub: `Was ${longDate(b.date)} · ${slotLabel(b.slot)}`, struck: true },
      {
        kind: "p",
        text: "Nothing was paid, so there's nothing to refund. If you didn't ask for this, or you'd like a different day, ring us and we'll put it right.",
      },
      { kind: "button", label: "Book another time", href: `${ctx.siteUrl.replace(/\/$/, "")}/book/` },
      ...(b.referralCode
        ? [
            {
              kind: "callout",
              tone: "plain",
              title: "Your referral code still works",
              code: b.referralCode,
              body: "Pass it on to a friend any time , they still get 5% off their fitting.",
            } satisfies Block,
          ]
        : []),
    ],
  });
}

/** To the customer, once the floor is down. */
export function thankYouEmail(ctx: Ctx, b: BookingData): Rendered {
  return render({
    siteUrl: ctx.siteUrl,
    subject: "Thank you from Quinton Carpets",
    preheader: "We hope you love the new floor. A few tips, and something for a friend.",
    reason: "You're getting this because we fitted a floor for you.",
    blocks: [
      { kind: "eyebrow", text: "All done" },
      { kind: "h1", text: `Enjoy the new floor, ${firstName(b.name)}.` },
      {
        kind: "p",
        text: "Thank you for choosing a local shop. If anything isn't quite right , a seam, a door that now catches, a bar that's moved , ring us and tell us.",
      },
      {
        kind: "list",
        title: "Looking after it",
        items: [
          "New carpet sheds a little for the first few weeks. Hoover often; it settles.",
          "Pull out a sprouting tuft with scissors, never by hand.",
          "Blot spills from the outside in. Don't rub.",
          "For laminate and vinyl: a damp mop, never a soaking one.",
        ],
      },
      ...(b.referralCode ? [referralCallout(b.referralCode)] : []),
      { kind: "p", text: `Reference ${b.ref} , quote it if you ring about this job.`, muted: true },
    ],
  });
}

/** Sample data, for the previews on /admin/emails/ and the tests. */
export const SAMPLE_BOOKING: BookingData = {
  ref: "QC-1910-7T4M",
  name: "Pat Seddon",
  phone: "07855 555 599",
  email: "pat@example.com",
  address: "12 Ridgacre Road",
  postcode: "B32 2TJ",
  date: "2026-10-22",
  slot: "am",
  notes: "Stairs and landing. Dog in the garden.",
  estimate: "QC-EST-4K9QX",
  referral: "QC-REF-H2NB",
  referralCode: "QC-REF-9WQE",
};

export const TEMPLATES = {
  confirmation: { label: "Booking confirmed (customer)", render: (c: Ctx, b: BookingData) => confirmationEmail(c, b) },
  shop: { label: "New booking (shop)", render: (c: Ctx, b: BookingData) => shopNewBookingEmail(c, b) },
  reminder: { label: "Day-before reminder (customer)", render: (c: Ctx, b: BookingData) => reminderEmail(c, b) },
  rescheduled: {
    label: "Booking moved (customer)",
    render: (c: Ctx, b: BookingData) => rescheduledEmail(c, b, { date: "2026-10-21", slot: "pm" }),
  },
  cancelled: { label: "Booking cancelled (customer)", render: (c: Ctx, b: BookingData) => cancelledEmail(c, b) },
  thanks: { label: "Thank you, after fitting (customer)", render: (c: Ctx, b: BookingData) => thankYouEmail(c, b) },
} as const;

export type TemplateName = keyof typeof TEMPLATES;
