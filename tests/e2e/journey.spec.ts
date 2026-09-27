import { test, expect, type Page } from "@playwright/test";
import { SLOT_CAPACITY, addDaysISO, dayOfWeek, todayISO, HORIZON_DAYS } from "../../src/lib/dates.ts";

/**
 * The whole point of the site: price a floor, book the free measure,
 * come away with a reference and a referral code.
 */

/** Pick the first bookable day in the calendar that falls on a given weekday. */
async function pickDay(page: Page, weekday?: number): Promise<string> {
  // Near the end of a month the day wanted may only be in the next
  // one, so look a month ahead before giving up.
  for (let month = 0; month < 2; month++) {
    const buttons = page.locator("#cal .days button:not([disabled])");
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const b = buttons.nth(i);
      const iso = (await b.getAttribute("data-d")) ?? "";
      if (weekday === undefined || new Date(`${iso}T00:00:00Z`).getUTCDay() === weekday) {
        await b.click();
        return iso;
      }
    }
    await page.getByRole("button", { name: "Next month" }).click();
  }
  throw new Error("no bookable day of that kind this month or next");
}

test("estimate, then book, and come away with a reference", async ({ page }) => {
  await page.goto("/estimate/");

  // The summary is live from the first paint — no empty state to click past.
  const total = page.locator("#estTotal");
  await expect(total).toContainText("£");
  const opening = await total.textContent();

  // The roll width the fitter would use is shown, not hidden.
  await expect(page.locator("#estLines")).toContainText("roll width, trim included");

  // Adding a room moves the number.
  await page.getByRole("button", { name: "+ Add a room" }).click();
  await expect(total).not.toHaveText(opening ?? "");

  // Going on to book saves the estimate, and the server mints its code.
  await page.getByRole("link", { name: "Book a free measure" }).click();
  await expect(page).toHaveURL(/\/book\/\?estimate=QC-EST-[A-Z0-9]{5}$/);

  // It carried the code across rather than making them retype it.
  const code = new URL(page.url()).searchParams.get("estimate")!;
  await expect(page.locator("#bEst")).toHaveValue(code);

  await page.locator("#bName").fill("Pat Seddon");
  await page.locator("#bPhone").fill("07855 555 599");
  await page.locator("#bEmail").fill("pat@example.com");
  await page.locator("#bPostcode").fill("B32 1BY");
  await page.locator("#bAddress").fill("589 Hagley Road West");

  await pickDay(page);
  await page.locator("#slots button:not([disabled])").first().click();
  await page.locator("#bConsent").check();

  // The server turns away anything submitted within three seconds of
  // the page loading — no person fills in eight fields and picks a
  // date that fast, but Playwright does. Take the time.
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: "Confirm my free measure" }).click();

  // The reference, at display size, and the referral code with it.
  const ref = page.locator(".refbig");
  await expect(ref).toBeVisible();
  await expect(ref).toHaveText(/^QC-\d{4}-[A-Z0-9]{4}$/);

  await expect(page.locator(".refcode")).toHaveText(/^QC-REF-[A-Z0-9]{4}$/);
  await expect(page.getByText("Booked — nothing to pay")).toBeVisible();

  // Their own number, in the callback promise.
  await expect(page.locator("#bookDone")).toContainText("07855 555 599");

  // And the booking can be looked up on its own page.
  const reference = (await ref.textContent())!.trim();
  await page.goto(`/booking/${reference}/`);
  await expect(page.locator(".refbig")).toHaveText(reference);
  await expect(page.getByText("Pat Seddon")).toBeVisible();

  // With the estimate they priced, worked out again by the server.
  await page.getByText(`Estimate ${code}`).click();
  await expect(page.getByText("Living room")).toBeVisible();
  await expect(page.getByText("roll width, trim included")).toBeVisible();
});

test("a full window is refused, even when everyone books at once", async ({ request, page }) => {
  // The last day of the diary, so this never gets in the way of the
  // journey above, which books the first free window.
  const date = addDaysISO(todayISO(), HORIZON_DAYS);
  const slot = dayOfWeek(date) === 0 ? "pm" : "am";

  // More people than the window holds, all pressing the button at the
  // same moment. Each from its own address, so the per-IP limit
  // doesn't turn them away before the capacity check can.
  const attempts = SLOT_CAPACITY + 3;
  const responses = await Promise.all(
    Array.from({ length: attempts }, (_, i) =>
      request.post("/api/bookings", {
        headers: { accept: "application/json", "x-real-ip": `198.51.100.${i + 1}` },
        data: {
          name: `Capacity test ${i + 1}`,
          phone: "07855 555 599",
          email: "capacity@example.com",
          postcode: "B32 1BY",
          address: "589 Hagley Road West",
          date,
          slot,
          consent: "yes",
        },
      }),
    ),
  );
  const statuses = responses.map((r) => r.status());

  // Earlier runs may already have filled it, so never more than the
  // capacity got in, and at least one was told the window is full.
  expect(statuses.filter((s) => s === 200).length).toBeLessThanOrEqual(SLOT_CAPACITY);
  expect(statuses.filter((s) => s === 409).length).toBeGreaterThanOrEqual(attempts - SLOT_CAPACITY);
  expect(statuses.every((s) => s === 200 || s === 409)).toBe(true);

  const refused = responses[statuses.indexOf(409)]!;
  expect(await refused.json()).toMatchObject({ slotFull: true });

  // And the calendar stops offering it.
  await page.goto(`/book/?m=${date.slice(0, 7)}&d=${date}`);
  const button = page.locator(`#slots button[data-s="${slot}"]`);
  await expect(button).toBeDisabled();
  await expect(button).toContainText("Fully booked");
  await expect(page.locator("#slotHint")).toContainText("already booked");
});

test("Sunday never offers the Late window", async ({ page }) => {
  await page.goto("/book/");
  await pickDay(page, 0); // 0 = Sunday

  // Offered, unless other bookings have already filled it — the
  // journey test books the first free window on every run.
  const offered = async (slot: string) => {
    const button = page.locator(`#slots button[data-s="${slot}"]`);
    if (await button.isDisabled()) await expect(button).toContainText("Fully booked");
  };

  await offered("am");
  await offered("pm");
  // The shop shuts at 4pm on a Sunday: closed, not full.
  const late = page.locator('#slots button[data-s="eve"]');
  await expect(late).toBeDisabled();
  await expect(late).toContainText("4pm – 6pm");
  await expect(page.locator("#slotHint")).toContainText(
    /Sunday, so we finish at 4pm|already booked/,
  );

  // And a Saturday has all three.
  await pickDay(page, 6);
  await offered("eve");
  await expect(page.locator('#slots button[data-s="eve"]')).toContainText(/4pm – 6pm|Fully booked/);
});

test("the calendar cannot go back before today", async ({ page }) => {
  await page.goto("/book/");
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByRole("button", { name: "Previous month" })).toBeEnabled();
});

test("every form error names the problem and the fix", async ({ page }) => {
  await page.goto("/book/");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();

  await expect(page.locator("#err-name")).toBeVisible();
  await expect(page.locator("#err-name")).toHaveText("Please tell us your name.");
  await expect(page.locator("#err-phone")).toHaveText("We need a number to ring you back on.");
  await expect(page.locator("#err-email")).toHaveText("That doesn't look like an email address.");
  await expect(page.locator("#err-postcode")).toHaveText(
    "Please add your postcode so we can plan the round.",
  );
  await expect(page.locator("#err-address")).toHaveText("Please add the address we're measuring.");
  await expect(page.locator("#dateErr")).toBeVisible();
  await expect(page.locator("#consentErr")).toBeVisible();

  // A malformed referral code is called out by shape.
  await page.locator("#bRef").fill("NONSENSE");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();
  await expect(page.locator("#err-referral")).toBeVisible();

  // A valid one is accepted without complaint.
  await page.locator("#bRef").fill("QC-REF-7T4M");
  await page.getByRole("button", { name: "Confirm my free measure" }).click();
  await expect(page.locator("#err-referral")).not.toBeVisible();
});

test("no payment anywhere on the site", async ({ page }) => {
  for (const path of ["/", "/ranges/", "/estimate/", "/book/", "/referrals/", "/visit/"]) {
    await page.goto(path);
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const word of ["checkout", "add to basket", "add to cart", "pay now", "card number", "deposit"]) {
      expect(text, `"${word}" must not appear on ${path}`).not.toContain(word);
    }
    // And nothing is ever called a quote.
    expect(text, `"quote" as a noun must not appear on ${path}`).not.toMatch(
      /\b(free|instant|get a|your) quote\b/,
    );
  }
});

test("booking a measure is free, and says so in three places", async ({ page }) => {
  await page.goto("/book/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Book it. It costs nothing.");
  await expect(page.getByRole("button", { name: "Confirm my free measure" })).toBeVisible();
  await expect(page.getByText("Free of charge · no card details · no obligation")).toBeVisible();
});

test("the ranges filter lives in the URL and works server-side", async ({ page }) => {
  await page.goto("/ranges/?material=Laminate");
  const cards = page.locator(".rangecard");
  await expect(cards).toHaveCount(2);
  await expect(page.locator(".swatch .tag").first()).toHaveText("Laminate");

  // Case-insensitive, because people type it themselves.
  await page.goto("/ranges/?material=carpet&room=stairs");
  await expect(page.locator(".rangecard")).toHaveCount(4);

  // A combination with nothing in it says so, in the shop's voice.
  await page.goto("/ranges/?material=Underlay&room=Bathroom");
  await expect(page.getByText("Nothing matches that combination")).toBeVisible();
});
