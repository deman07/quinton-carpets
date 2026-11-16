/**
 * GET /admin/export.csv , whatever the diary is showing, as a
 * spreadsheet. Takes the same query string as /admin/, so the
 * "Download" link on any view downloads that view.
 */

import type { APIRoute } from "astro";
import { listBookings, readFilter } from "../../lib/server/diary.ts";
import { slotLabel, todayISO } from "../../lib/dates.ts";
import { cell } from "../../lib/csv.ts";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const today = todayISO();
  const rows = await listBookings(readFilter(url, today), today);

  const header = [
    "Reference", "Date", "Window", "Status", "Name", "Phone", "Email", "Address", "Postcode",
    "Their notes", "Shop notes", "Estimate", "Referred by", "Their code", "Booked at",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.ref, r.date, slotLabel(r.slot), r.status, r.name, r.phone, r.email, r.address, r.postcode,
        r.notes, r.staff_notes, r.estimate_code, r.referred_by, r.code, r.created_at,
      ]
        .map(cell)
        .join(","),
    ),
  ];

  // The byte-order mark tells Excel it is UTF-8, so "£" and "–" survive.
  return new Response("\uFEFF" + lines.join("\r\n") + "\r\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="quinton-diary-${today}.csv"`,
      "cache-control": "no-store",
    },
  });
};
