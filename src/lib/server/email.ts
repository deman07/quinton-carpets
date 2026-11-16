/**
 * Sending the site's emails, through Resend.
 *
 * What each email says lives in lib/email-templates.ts; this file only
 * works out who it is from and to, attaches the calendar file, and
 * posts it. Every function resolves to { sent, reason } and never
 * throws, because an email is always the last thing done: a mail
 * provider having a bad morning must never lose somebody's booking or
 * undo a change in the diary.
 *
 * With no RESEND_API_KEY nothing is sent, and the reason says so.
 */

import { getEnv } from "./env.ts";
import { getSettings } from "./catalogue.ts";
import {
  confirmationEmail,
  shopNewBookingEmail,
  reminderEmail,
  rescheduledEmail,
  cancelledEmail,
  thankYouEmail,
  type BookingData,
  type Ctx,
  type Rendered,
} from "../email-templates.ts";
import { calendar, type CalendarEvent } from "../ics.ts";
import type { SlotKey } from "../dates.ts";
import { BUSINESS } from "../../data/business.ts";

export type { BookingData };
export type Sent = { sent: boolean; reason: string };

interface MailConfig extends Ctx {
  apiKey?: string;
  from: string;
  shop: string;
}

/** The settings table wins; the environment variables are the fallback. */
async function config(): Promise<MailConfig> {
  const env = getEnv();
  const s = await getSettings();
  return {
    apiKey: env.RESEND_API_KEY,
    from: s.mailFrom ?? env.MAIL_FROM ?? "Quinton Carpets <bookings@quintoncarpets.co.uk>",
    shop: s.shopEmail ?? env.SHOP_EMAIL ?? BUSINESS.email,
    siteUrl: s.siteUrl,
  };
}

interface Attachment {
  filename: string;
  content: string;
}

async function send(
  cfg: MailConfig,
  to: string,
  mail: Rendered,
  opts: { replyTo?: string; attachments?: Attachment[] } = {},
): Promise<Sent> {
  if (!cfg.apiKey) return { sent: false, reason: "no RESEND_API_KEY configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: [to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: opts.replyTo ?? cfg.shop,
        ...(opts.attachments?.length
          ? {
              attachments: opts.attachments.map((a) => ({
                filename: a.filename,
                content: Buffer.from(a.content, "utf8").toString("base64"),
              })),
            }
          : {}),
      }),
    });
    return { sent: res.ok, reason: res.ok ? "" : `${res.status} ${await res.text()}` };
  } catch (err) {
    return { sent: false, reason: String(err) };
  }
}

/** The visit, as a calendar file the customer's phone can open. */
function visitIcs(
  cfg: MailConfig,
  b: BookingData,
  opts: { cancelled?: boolean; sequence?: number } = {},
): Attachment {
  const event: CalendarEvent = {
    uid: `${b.ref}@quintoncarpets.co.uk`,
    date: b.date,
    slot: b.slot as SlotKey,
    summary: "Free measure , Quinton Carpets",
    description: `Reference ${b.ref}. We'll arrive within the window. To change it, ring ${BUSINESS.phone}.`,
    location: `${b.address}, ${b.postcode}`,
    url: `${cfg.siteUrl.replace(/\/$/, "")}/booking/${b.ref}/`,
    cancelled: opts.cancelled,
    sequence: opts.sequence,
  };
  return {
    filename: "free-measure.ics",
    content: calendar([event], { method: opts.cancelled ? "CANCEL" : "PUBLISH" }),
  };
}

/** A sequence number that only ever goes up, so a newer file replaces an older one. */
const sequenceNow = () => Math.floor(Date.now() / 1000) - 1_700_000_000;

/** The two emails for a new booking: the customer's, and the shop's. */
export async function sendBookingEmails(b: BookingData): Promise<Sent[]> {
  const cfg = await config();
  return Promise.all([
    send(cfg, b.email, confirmationEmail(cfg, b), { attachments: [visitIcs(cfg, b)] }),
    send(cfg, cfg.shop, shopNewBookingEmail(cfg, b), { replyTo: b.email }),
  ]);
}

/** The customer's confirmation on its own, when the shop resends it. */
export async function sendConfirmation(b: BookingData): Promise<Sent> {
  const cfg = await config();
  return send(cfg, b.email, confirmationEmail(cfg, b), { attachments: [visitIcs(cfg, b)] });
}

export async function sendReminder(b: BookingData): Promise<Sent> {
  const cfg = await config();
  return send(cfg, b.email, reminderEmail(cfg, b), { attachments: [visitIcs(cfg, b)] });
}

export async function sendRescheduled(b: BookingData, was: { date: string; slot: string }): Promise<Sent> {
  const cfg = await config();
  return send(cfg, b.email, rescheduledEmail(cfg, b, was), {
    attachments: [visitIcs(cfg, b, { sequence: sequenceNow() })],
  });
}

export async function sendCancelled(b: BookingData): Promise<Sent> {
  const cfg = await config();
  return send(cfg, b.email, cancelledEmail(cfg, b), {
    attachments: [visitIcs(cfg, b, { cancelled: true, sequence: sequenceNow() })],
  });
}

export async function sendThanks(b: BookingData): Promise<Sent> {
  const cfg = await config();
  return send(cfg, b.email, thankYouEmail(cfg, b));
}

/** Sends one template with sample data, for the preview page's "send me a test". */
export async function sendTest(to: string, mail: (ctx: Ctx) => Rendered): Promise<Sent> {
  const cfg = await config();
  const rendered = mail(cfg);
  return send(cfg, to, { ...rendered, subject: `[Test] ${rendered.subject}` });
}

export const siteContext = async (): Promise<Ctx> => ({ siteUrl: (await getSettings()).siteUrl });
