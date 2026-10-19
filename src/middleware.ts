/**
 * Two jobs, in order.
 *
 * 1. The diary is staff only. Every /admin/ page and /api/admin/
 *    endpoint needs a logged-in staff member (see lib/server/auth.ts),
 *    who is put on Astro.locals.staff for the page to use. A page
 *    gets sent to the login screen; an endpoint gets a 401. Anything
 *    that changes something must also come from this site's own pages.
 *
 * 2. Lets Vercel's CDN hold the public pages for a minute.
 *
 *    Every page is rendered on demand, because the ranges, rates and
 *    settings live in the database. Without this each visitor would
 *    cost a function call and a query; with it the CDN answers almost
 *    every request, goes back to the function at most once a minute
 *    per URL, and keeps serving the last page while it does. An edit
 *    in the Supabase Table Editor is live within about a minute.
 *
 *    Browsers are told not to keep their own copy (max-age=0), so
 *    nobody is left looking at an old price for longer than the
 *    CDN's minute.
 */

import { defineMiddleware } from "astro:middleware";
import { SESSION_COOKIE, staffForToken } from "./lib/server/auth.ts";

const SHARED = "public, max-age=0, s-maxage=60, stale-while-revalidate=86400";

/**
 * Never cached: the booking form shows today's free windows, the
 * lookup and the diary are personal, and the API answers per request.
 */
const PRIVATE = [/^\/book\/?$/, /^\/booking\//, /^\/admin(\/|$)/, /^\/api\//];

const STAFF_PAGE = /^\/admin(\/|$)/;
const STAFF_API = /^\/api\/admin\//;
const OPEN = /^\/admin\/login\/?$/;

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const isPage = STAFF_PAGE.test(path);
  const isApi = STAFF_API.test(path);

  if ((isPage || isApi) && !OPEN.test(path)) {
    const noStore = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };

    // A form or fetch from another site riding on the cookie. SameSite
    // already stops most of it; this stops the rest.
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      const origin = context.request.headers.get("origin");
      if (origin && origin !== context.url.origin) {
        return new Response("Cross-site request refused.", { status: 403, headers: noStore });
      }
    }

    const staff = await staffForToken(context.cookies.get(SESSION_COOKIE)?.value);
    if (!staff) {
      if (isApi) {
        return new Response(JSON.stringify({ error: "Please log in again." }), {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8", ...noStore },
        });
      }
      const back = encodeURIComponent(path + context.url.search);
      return context.redirect(`/admin/login/?next=${back}`, 303);
    }
    context.locals.staff = staff;
  }

  const response = await next();

  const cacheable =
    context.request.method === "GET" &&
    response.status === 200 &&
    !PRIVATE.some((re) => re.test(path)) &&
    !response.headers.has("cache-control");

  if (cacheable) response.headers.set("cache-control", SHARED);
  return response;
});
