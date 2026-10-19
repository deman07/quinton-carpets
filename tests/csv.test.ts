import { describe, it, expect } from "vitest";
import { cell } from "../src/lib/csv.ts";

describe("spreadsheet cells", () => {
  it("leaves plain values alone", () => {
    expect(cell("Pat Seddon")).toBe("Pat Seddon");
    expect(cell(null)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(cell("12 Ridgacre Road, Quinton")).toBe('"12 Ridgacre Road, Quinton"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell("one\ntwo")).toBe('"one\ntwo"');
  });

  it("never lets a cell run as a formula", () => {
    expect(cell("=HYPERLINK(\"http://x\")")).toMatch(/^"'=/);
    expect(cell("+44 7855 555599")).toBe("'+44 7855 555599");
    expect(cell("@SUM(A1)")).toBe("'@SUM(A1)");
  });
});
