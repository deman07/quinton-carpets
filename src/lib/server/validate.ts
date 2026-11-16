/**
 * Server-side validation.
 *
 * Everything the browser checked is checked again here. The client's
 * validation is a courtesy; this is the one that counts.
 */

import { isBookableDate, isBookableSlot } from "../dates.ts";
import type { RoomInput } from "../pricing.ts";

export interface BookingPayload {
  name: string;
  phone: string;
  email: string;
  postcode: string;
  address: string;
  estimate?: string;
  referral?: string;
  date: string;
  slot: string;
  notes?: string;
  consent?: string;
  company?: string;
  started?: string;
}

export interface Invalid {
  error: string;
  /** The id of the field to highlight, so the browser can point at it. */
  field?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Errors name the problem and the fix, and don't apologise. */
export function validateBooking(
  raw: Record<string, unknown>,
  now: Date = new Date(),
): { ok: true; value: BookingPayload } | { ok: false } & Invalid {
  const name = str(raw.name);
  const phone = str(raw.phone);
  const email = str(raw.email);
  const postcode = str(raw.postcode).toUpperCase();
  const address = str(raw.address);
  const estimate = str(raw.estimate).toUpperCase();
  const referral = str(raw.referral).toUpperCase();
  const date = str(raw.date);
  const slot = str(raw.slot);
  const notes = str(raw.notes);
  const consent = str(raw.consent);
  const company = str(raw.company);
  const started = Number(str(raw.started) || 0);

  // The honeypot. A person never sees this field, so anything in it
  // came from something that isn't a person.
  if (company) return { ok: false, error: "That didn't go through. Please ring the shop on 0121 423 3322." };

  // And the timing check: three seconds is faster than anyone can
  // fill in eight fields and pick a date.
  if (started > 0 && now.getTime() - started < 3000) {
    return { ok: false, error: "That was quick , give it a moment and try again." };
  }

  if (!name) return { ok: false, error: "Please tell us your name.", field: "bName" };
  if (phone.replace(/\D/g, "").length < 10) {
    return { ok: false, error: "We need a number to ring you back on.", field: "bPhone" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That doesn't look like an email address.", field: "bEmail" };
  }
  if (!postcode) {
    return { ok: false, error: "Please add your postcode so we can plan the round.", field: "bPostcode" };
  }
  if (!address) {
    return { ok: false, error: "Please add the address we're measuring.", field: "bAddress" };
  }
  if (referral && !/^QC-REF-[A-Z0-9]{4}$/.test(referral)) {
    return {
      ok: false,
      error: "That code isn't in the right shape , it should look like QC-REF-7T4M.",
      field: "bRef",
    };
  }
  if (estimate && !/^QC-EST-[A-Z0-9]{5}$/.test(estimate)) {
    return {
      ok: false,
      error: "That estimate code isn't in the right shape , it should look like QC-EST-4K7QW.",
      field: "bEst",
    };
  }
  if (!isBookableDate(date, now)) {
    return { ok: false, error: "Please choose a date and a time window." };
  }
  // Sunday has no Late window because the shop shuts at 4pm, and the
  // server is where that is actually enforced.
  if (!isBookableSlot(date, slot, now)) {
    return { ok: false, error: "We can't do that time on that day. Please pick another window." };
  }
  if (consent !== "yes" && consent !== "on" && consent !== "true") {
    return { ok: false, error: "Please tick the box so we can call you back." };
  }

  return {
    ok: true,
    value: {
      name: name.slice(0, 120),
      phone: phone.slice(0, 40),
      email: email.slice(0, 160),
      postcode: postcode.slice(0, 12),
      address: address.slice(0, 300),
      estimate: estimate || undefined,
      referral: referral || undefined,
      date,
      slot,
      notes: notes.slice(0, 1000) || undefined,
    },
  };
}

/* ---------------- estimates ---------------- */

export interface EstimateRequest {
  /** Range ids. The prices are looked up on the server, never taken from here. */
  floor: string;
  underlay: string | null;
  rooms: RoomInput[];
  fit: "fitted" | "supply";
  extras: { uplift: boolean; gripper: boolean; doorbars: boolean; furniture: boolean };
  discountCode: string;
}

/** Bigger than any house, small enough that nobody prices a warehouse by accident. */
const MAX_ROOMS = 20;
const MAX_METRES = 30;
const MAX_STEPS = 60;

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/**
 * The estimator's state, checked. A room the customer left blank is
 * dropped rather than refused, the same as the estimator ignores it
 * while they type.
 */
export function validateEstimate(raw: unknown): { ok: true; value: EstimateRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Couldn't read that estimate." };
  const r = raw as Record<string, unknown>;

  const floor = str(r.floor);
  if (!floor) return { ok: false, error: "Pick a floor first." };
  const underlay = str(r.underlay);

  if (!Array.isArray(r.rooms)) return { ok: false, error: "Add a room first." };
  if (r.rooms.length > MAX_ROOMS) {
    return { ok: false, error: `That's more than ${MAX_ROOMS} rooms , ring the shop and we'll price it with you.` };
  }

  const rooms: RoomInput[] = [];
  for (const item of r.rooms as unknown[]) {
    if (!item || typeof item !== "object") continue;
    const room = item as Record<string, unknown>;
    const name = str(room.name).slice(0, 60);
    if (room.kind === "stairs") {
      const steps = Math.round(num(room.steps));
      if (!(steps > 0)) continue;
      if (steps > MAX_STEPS) return { ok: false, error: `${name || "Those stairs"}: that's a lot of steps.` };
      rooms.push({ kind: "stairs", name: name || "Stairs", steps });
    } else {
      const width = num(room.width);
      const length = num(room.length);
      if (!(width > 0 && length > 0)) continue;
      if (width > MAX_METRES || length > MAX_METRES) {
        return { ok: false, error: `${name || "That room"} is over ${MAX_METRES}m , is that in metres?` };
      }
      rooms.push({ kind: "room", name: name || "Room", width, length });
    }
  }
  if (!rooms.length) return { ok: false, error: "Add a room first." };

  const e = (r.extras ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    value: {
      floor,
      underlay: underlay && underlay !== "none" ? underlay : null,
      rooms,
      fit: r.fit === "supply" ? "supply" : "fitted",
      extras: {
        uplift: e.uplift === true,
        gripper: e.gripper === true,
        doorbars: e.doorbars === true,
        furniture: e.furniture === true,
      },
      discountCode: str(r.discountCode).toUpperCase().slice(0, 40),
    },
  };
}
