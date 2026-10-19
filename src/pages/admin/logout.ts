/**
 * POST /admin/logout/ — ends this browser's session.
 * A POST, so a link on another site cannot log somebody out.
 */

import type { APIRoute } from "astro";
import { endSession, SESSION_COOKIE } from "../../lib/server/auth.ts";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await endSession(cookies.get(SESSION_COOKIE)?.value);
  cookies.delete(SESSION_COOKIE, { path: "/" });
  return redirect("/admin/login/", 303);
};
