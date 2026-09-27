/**
 * POST /api/codes — what is this code worth?
 *
 * The browser posts a code and gets back a verdict; it never holds
 * the rules and never decides a discount for itself. The rules
 * themselves are in src/lib/server/discounts.ts.
 *
 * Discounts apply to LABOUR ONLY — fitting and fitting extras.
 * Materials are already at the shop's best price and never discount.
 */

import type { APIRoute } from "astro";
import { json, clientIp, rateLimit } from "../../lib/server/env.ts";
import { verdictFor } from "../../lib/server/discounts.ts";
import type { DiscountVerdict } from "../../lib/pricing.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const ip = clientIp(request);

  // Guessing four characters is not worth anyone's time, but there
  // is no reason to let a script sit there trying.
  if (!(await rateLimit(`codes:${ip}`, 30))) {
    return json({
      valid: false,
      kind: "none",
      message: "Too many tries. Bring the code into the shop and we'll apply it.",
    } satisfies DiscountVerdict, 429);
  }

  let code = "";
  let ownerRef = "";
  try {
    const body = (await request.json()) as { code?: string; ownerRef?: string };
    code = (body.code ?? "").trim().toUpperCase();
    ownerRef = (body.ownerRef ?? "").trim().toUpperCase();
  } catch {
    return json({ valid: false, kind: "none", message: "We didn't catch that code." } satisfies DiscountVerdict, 400);
  }

  return json(await verdictFor(code, ownerRef));
};
