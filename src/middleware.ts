/**
 * Lets Vercel's CDN hold the public pages for a minute.
 *
 * Every page is rendered on demand, because the ranges, rates and
 * settings live in the database. Without this each visitor would cost
 * a function call and a query; with it the CDN answers almost every
 * request, goes back to the function at most once a minute per URL,
 * and keeps serving the last page while it does. An edit in the
 * Supabase Table Editor is live within about a minute.
 *
 * Browsers are told not to keep their own copy (max-age=0), so nobody
 * is left looking at an old price for longer than the CDN's minute.
 */

import { defineMiddleware } from "astro:middleware";

const SHARED = "public, max-age=0, s-maxage=60, stale-while-revalidate=86400";

/**
 * Never cached: the booking form shows today's free windows, the
 * lookup and the diary are personal, and the API answers per request.
 */
const PRIVATE = [/^\/book\/?$/, /^\/booking\//, /^\/admin(\/|$)/, /^\/api\//];

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  const cacheable =
    context.request.method === "GET" &&
    response.status === 200 &&
    !PRIVATE.some((re) => re.test(context.url.pathname)) &&
    !response.headers.has("cache-control");

  if (cacheable) response.headers.set("cache-control", SHARED);
  return response;
});
