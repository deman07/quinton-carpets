/**
 * POST /api/estimates — save an estimate and hand back its code.
 *
 * Called when the customer goes from the estimator to the booking
 * form, so the fitter who rings them already has the rooms, the floor
 * and the figures on screen.
 *
 * The browser sends what the customer chose, never what it costs:
 * the prices come from the ranges and PRICES here, the discount is
 * checked again here, and the code is minted here so nobody can
 * write over somebody else's estimate by guessing theirs.
 */

import type { APIRoute } from "astro";
import { json, clientIp, rateLimit } from "../../lib/server/env.ts";
import { db } from "../../lib/server/db.ts";
import { validateEstimate } from "../../lib/server/validate.ts";
import { verdictFor } from "../../lib/server/discounts.ts";
import { allRanges, floorRanges, underlayRanges } from "../../lib/ranges.ts";
import { estimate, PRICES, type EstimateInput } from "../../lib/pricing.ts";
import { mintEstimateCode } from "../../lib/codes.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const now = new Date();

  // Somebody fiddling with the estimator for an evening might book a
  // handful of times. Nobody books thirty.
  if (!(await rateLimit(`estimates:${clientIp(request)}`, 30, now))) {
    return json({ error: "That's a lot of estimates from here. Please ring the shop on 0121 423 3322." }, 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Couldn't read that estimate." }, 400);
  }

  const check = validateEstimate(raw);
  if (!check.ok) return json({ error: check.error }, 400);
  const req = check.value;

  const ranges = await allRanges();
  const floor = floorRanges(ranges).find((r) => r.id === req.floor);
  if (!floor) return json({ error: "That floor isn't one of ours any more. Please pick another." }, 400);
  const underlay = req.underlay ? underlayRanges(ranges).find((r) => r.id === req.underlay) : null;
  if (req.underlay && !underlay) {
    return json({ error: "That underlay isn't one of ours any more. Please pick another." }, 400);
  }

  const discount = req.discountCode ? await verdictFor(req.discountCode) : null;

  const input: EstimateInput = {
    floor: { name: floor.name, pricePerSqm: floor.price, widths: floor.widths, hard: floor.hard },
    underlay: underlay ? { name: underlay.name, pricePerSqm: underlay.price } : null,
    rooms: req.rooms,
    fit: req.fit,
    extras: req.extras,
    discount: discount?.valid ? discount : null,
    rates: PRICES,
  };
  const result = estimate(input);

  // Kept alongside the figures so the record reads on its own, even
  // after a range is renamed or repriced.
  const stored = { ...input, floorId: floor.id, underlayId: underlay?.id ?? null };

  // A collision is vanishingly unlikely, but the code is the key.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = mintEstimateCode();
    try {
      const row = await db
        .prepare(
          `INSERT INTO estimates (code, input, result, total, created_at)
           VALUES (?1, ?2::jsonb, ?3::jsonb, ?4, ?5)
           ON CONFLICT (code) DO NOTHING
           RETURNING code`,
        )
        // Objects, not strings: the driver encodes a jsonb parameter
        // itself, and a pre-stringified one is stored as a JSON string.
        .bind(code, stored, result, result.total, now.toISOString())
        .first<{ code: string }>();
      if (row) return json({ code, total: result.total });
    } catch (err) {
      console.error("estimate insert failed", err);
      break;
    }
  }

  return json({ error: "We couldn't save that estimate. You can still book — we'll price it on the measure." }, 500);
};

/** Anything else here is a mistake, and says so plainly. */
export const ALL: APIRoute = () =>
  json({ error: "Send an estimate with POST." }, 405, { allow: "POST" });
