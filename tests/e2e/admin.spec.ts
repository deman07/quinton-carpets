import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { addDaysISO, todayISO } from "../../src/lib/dates.ts";

/**
 * The staff diary: the login in front of it, and the changes made
 * from it. Logs in with ADMIN_USER / ADMIN_PASSWORD from .env, which
 * make the owner's account on a fresh database.
 */

function cred(name: string): string {
  if (process.env[name]) return process.env[name]!;
  const text = readFileSync(new URL("../../.env", import.meta.url), "utf8");
  return (new RegExp(`^\s*${name}\s*=\s*(.+)$`, "m").exec(text)?.[1] ?? "").replace(/^["']|["']$/g, "").trim();
}

async function logIn(page: Page) {
  await page.goto("/admin/");
  await expect(page).toHaveURL(/\/admin\/login\//);
  await page.locator("#username").fill(cred("ADMIN_USER"));
  await page.locator("#password").fill(cred("ADMIN_PASSWORD"));
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("heading", { name: "The diary" })).toBeVisible();
}

test("the diary is behind a login, and a wrong password is refused", async ({ page, request }) => {
  const res = await request.get("/admin/", { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  expect((await request.post("/api/admin/bookings/QC-0101-AAAA", { data: {} })).status()).toBe(401);

  await page.goto("/admin/login/");
  await page.locator("#username").fill(cred("ADMIN_USER"));
  await page.locator("#password").fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("alert")).toContainText("don't match");
});

test("find a booking, note it, move it and cancel it", async ({ page, request }) => {
  // A booking of our own, far enough ahead not to collide with the journey tests.
  const date = addDaysISO(todayISO(), 40);
  const name = `Diary Test ${Date.now().toString(36)}`;
  const made = await request.post("/api/bookings", {
    headers: { accept: "application/json", "x-real-ip": "203.0.113.77" },
    data: { name, phone: "07855 555 599", email: "diary@example.com", postcode: "B32 1BY", address: "1 Test Road", date, slot: "am", consent: "yes" },
  });
  expect(made.status(), await made.text()).toBe(200);
  const { ref } = (await made.json()) as { ref: string };

  await logIn(page);
  await page.getByLabel("Search every booking").fill(name);
  await page.getByRole("button", { name: "Search" }).click();
  const row = page.locator(`[data-ref="${ref}"]`);
  await expect(row).toBeVisible();

  await row.getByText("Manage booking").click();
  await row.getByLabel(/Shop notes/).fill("Side gate");
  await row.getByRole("button", { name: "Save notes" }).click();
  await expect(row.locator("[data-pane-msg]")).toHaveText("Notes saved.");

  await row.getByLabel("Window", { exact: true }).selectOption("pm");
  await row.getByRole("checkbox", { name: "Email the customer the new time" }).uncheck();
  await row.getByRole("button", { name: "Move booking" }).click();
  await expect(page.locator("#flash")).toContainText("Moved");
  await expect(row.locator(".whenline")).toContainText("Afternoon");

  page.once("dialog", (d) => d.accept());
  await row.getByText("Manage booking").click();
  await row.getByRole("button", { name: "Cancel this booking" }).click();
  await expect(page.locator("#flash")).toContainText("Cancelled");
  await expect(row.locator("[data-chip]")).toHaveText("cancelled");
  await row.getByText("Manage booking").click();
  await expect(row.locator(".history")).toContainText("Moved from");
  await expect(row.locator(".history")).toContainText("Cancelled");

  // The customer's own page says so too.
  await page.goto(`/booking/${ref}/`);
  await expect(page.getByText(/Cancelled — this visit won't go ahead/)).toBeVisible();
});
