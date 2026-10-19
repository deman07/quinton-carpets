/**
 * GET /api/bookings/:ref — a customer reading their own booking.
 *
 * Staff change bookings through /api/admin/bookings/:ref, behind the
 * diary's login.
 */

import type { APIRoute } from "astro";
import { json, clientIp, ipBlock, overLimit, countAttempt } from "../../../lib/server/env.ts";
import { db } from "../../../lib/server/db.ts";

export const prerender = false;

const REF_RE = /^QC-\d{4}-[A-Z0-9]{4}$/;

export const GET: APIRoute = async ({ params, request }) => {
  const ref = String(params.ref ?? "").toUpperCase();
  const ip = clientIp(request);
  const throttleKey = `lookup:${ip}`;
  const blockKey = `lookupnet:${ipBlock(ip)}`;

  // A hard ceiling first, so a flood cannot make the database work for
  // it; the miss counter below is what actually stops guessing. Both
  // are checked after the lookup succeeds or fails, so a customer with
  // a real reference is served regardless.
  if (await overLimit(throttleKey, 300)) {
    return json({ error: "Too many lookups. Please ring the shop on 0121 423 3322." }, 429, {
      "retry-after": "3600",
    });
  }

  if (!REF_RE.test(ref)) {
    await countAttempt(throttleKey);
    return json({ error: "That isn't a booking reference." }, 400);
  }

  const row = await db.prepare(
    `SELECT b.ref, b.name, b.date, b.slot, b.status, r.code AS referral_code, r.redemptions
       FROM bookings b LEFT JOIN referral_codes r ON r.owner_ref = b.ref
      WHERE b.ref = ?1`,
  )
    .bind(ref)
    .first();

  if (!row) {
    const [misses, blockMisses] = await Promise.all([
      countAttempt(throttleKey),
      countAttempt(blockKey),
    ]);
    if (misses > 25 || blockMisses > 60) {
      return json({ error: "Too many lookups. Please ring the shop on 0121 423 3322." }, 429, {
        "retry-after": "3600",
      });
    }
    return json({ error: "We can't find that reference." }, 404);
  }
  return json(row, 200, { "cache-control": "no-store" });
};
