/**
 * POST /api/admin/bookings/:ref — every change the diary makes to a
 * booking. Staff only: src/middleware.ts has already checked the
 * session and the origin before this runs.
 *
 * The body is one action, e.g. { "action": "cancel", "notify": true }.
 * See lib/server/diary.ts for the list.
 */

import type { APIRoute } from "astro";
import { json } from "../../../../lib/server/env.ts";
import { applyAction, type Action } from "../../../../lib/server/diary.ts";
import { isBookingRef } from "../../../../lib/codes.ts";

export const prerender = false;

export const POST: APIRoute = async ({ params, request, locals }) => {
  const ref = String(params.ref ?? "").toUpperCase();
  if (!isBookingRef(ref)) return json({ error: "That isn't a booking reference." }, 400);

  let body: Action;
  try {
    body = (await request.json()) as Action;
  } catch {
    return json({ error: "Couldn't read that." }, 400);
  }

  try {
    const out = await applyAction(ref, body, locals.staff!);
    if (!out.ok) return json({ error: out.error, full: out.full }, out.status);
    return json({ ok: true, message: out.message, booking: out.booking });
  } catch (err) {
    console.error("diary change failed", err);
    return json({ error: "That didn't save. Try again in a moment." }, 500);
  }
};

export const ALL: APIRoute = () => json({ error: "Send a change with POST." }, 405, { allow: "POST" });
