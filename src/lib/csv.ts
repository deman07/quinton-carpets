/** Spreadsheet export helpers. */

/**
 * Quotes a cell, and defuses anything a spreadsheet would run as a
 * formula — a customer can type "=HYPERLINK(...)" into the notes box.
 */
export function cell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}
