/**
 * What a code is worth.
 *
 * The code table lives here, on the server. The browser posts a
 * code to /api/codes and gets back a verdict; it never holds the
 * rules and never decides a discount for itself. /api/estimates asks
 * the same question again before it saves an estimate, for the same
 * reason.
 *
 * Discounts apply to LABOUR ONLY , fitting and fitting extras.
 * Materials are already at the shop's best price and never discount.
 */

import { db } from "./db.ts";
import type { DiscountVerdict } from "../pricing.ts";
import { REFERRAL_RE } from "../codes.ts";

const UNKNOWN: DiscountVerdict = {
  valid: false,
  kind: "none",
  message: "We don't recognise that code. Referral codes look like QC-REF-7T4M.",
};

/**
 * @param code     already trimmed and upper-cased
 * @param ownerRef the booking reference of whoever is asking, when
 *                 known, so their own referral code can be refused
 */
export async function verdictFor(code: string, ownerRef = ""): Promise<DiscountVerdict> {
  if (!code) return { valid: false, kind: "none", message: "Type a code in first." };

  /* ---- a referral code ---- */
  if (REFERRAL_RE.test(code)) {
    const row = await db.prepare(
      `SELECT code, owner_ref, reward_earned FROM referral_codes WHERE code = ?1`,
    )
      .bind(code)
      .first<{ code: string; owner_ref: string; reward_earned: number }>();

    if (!row) return UNKNOWN;

    // Using your own code is refused, and the refusal says what to
    // do with it instead.
    if (ownerRef && ownerRef === row.owner_ref) {
      return {
        valid: false,
        kind: "none",
        message: "That's your own code, pass it to a friend and the 20% comes back to you.",
      };
    }

    // A code whose owner has earned their reward is worth 20% to the
    // owner. Used by anyone else it is the friend's 10%.
    if (row.reward_earned === 1) {
      return {
        valid: true,
        kind: "reward",
        percentOff: 20,
        code,
        message: "Your referral reward, 20% off fitting",
      };
    }

    return {
      valid: true,
      kind: "referral",
      percentOff: 5,
      code,
      message: "Friend's referral code, 5% off fitting",
    };
  }

  /* ---- a seasonal promotion ---- */
  const promo = await db.prepare(
    `SELECT code, percent_off, amount_off, message, expires_at
       FROM promo_codes WHERE code = ?1 AND active = 1`,
  )
    .bind(code)
    .first<{
      code: string;
      percent_off: number | null;
      amount_off: number | null;
      message: string;
      expires_at: string | null;
    }>();

  if (promo && (!promo.expires_at || promo.expires_at >= new Date().toISOString().slice(0, 10))) {
    return {
      valid: true,
      kind: "promo",
      ...(promo.percent_off ? { percentOff: promo.percent_off } : {}),
      ...(promo.amount_off ? { amountOff: promo.amount_off } : {}),
      code,
      message: promo.message,
    };
  }

  return UNKNOWN;
}
