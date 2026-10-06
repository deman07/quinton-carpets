import type { APIRoute } from "astro";
import { getSettings } from "../lib/server/catalogue.ts";

/**
 * robots.txt, which differs by deployment.
 *
 * A demo deployment carries the shop's name but placeholder prices and
 * invented range names, and its canonical tags point at a domain that
 * is not live yet. Letting that be crawled would put fiction about a
 * real business into search results, so the demo refuses everything.
 * Clearing DEMO_MODE restores the real file.
 */
const demo = process.env.DEMO_MODE === "1";

export const GET: APIRoute = async () => {
  const { siteUrl } = await getSettings();
  const body = demo
    ? ["# Demo deployment — not for indexing.", "User-agent: *", "Disallow: /", ""].join("\n")
    : [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin/",
        "Disallow: /booking/",
        "Disallow: /api/",
        "",
        `Sitemap: ${siteUrl}/sitemap.xml`,
        "",
      ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
