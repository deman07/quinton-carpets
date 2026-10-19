import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblem } from "../src/lib/server/auth.ts";

describe("staff passwords", () => {
  it("are stored as a salted scrypt hash, never as themselves", async () => {
    const a = await hashPassword("correct horse battery");
    const b = await hashPassword("correct horse battery");
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(a).not.toContain("correct horse");
    expect(a).not.toBe(b);
  });

  it("check the right one and refuse the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("correct horse batterY", h)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("must be at least ten characters", () => {
    expect(passwordProblem("short")).toMatch(/10/);
    expect(passwordProblem("long enough now")).toBeNull();
  });
});
