import type { APIRoute } from "astro";
import { getRanges, getSettings } from "../lib/server/catalogue.ts";

/**
 * Only the pages a customer should land on from a search. The
 * booking lookup and the diary are private, and filtered range
 * views are the same page with a query string.
 */
const PAGES = [
  { path: "/", priority: "1.0", changefreq: "monthly" },
  { path: "/ranges/", priority: "0.9", changefreq: "weekly" },
  { path: "/estimate/", priority: "0.9", changefreq: "monthly" },
  { path: "/book/", priority: "0.9", changefreq: "monthly" },
  { path: "/referrals/", priority: "0.6", changefreq: "yearly" },
  { path: "/visit/", priority: "0.8", changefreq: "yearly" },
  { path: "/privacy/", priority: "0.2", changefreq: "yearly" },
];

export const GET: APIRoute = async () => {
  const base = (await getSettings()).siteUrl;
  const today = new Date().toISOString().slice(0, 10);

  // A page per range. Without the database the sitemap still lists
  // the fixed pages rather than failing.
  const ranges = await getRanges().catch(() => []);
  const pages = [
    ...PAGES,
    ...ranges.map((r) => ({ path: `/ranges/${r.id}/`, priority: "0.7", changefreq: "monthly" })),
  ];

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(
  (p) => `  <url>
    <loc>${base}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
).join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
};
