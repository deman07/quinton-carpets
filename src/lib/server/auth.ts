/**
 * Staff logins for the diary.
 *
 * Each person has their own account in the `staff` table, with the
 * password stored as an scrypt hash. Logging in sets one cookie: a
 * random token, of which only a SHA-256 hash is kept in
 * `staff_sessions`. Neither table holds anything that would let
 * somebody with a copy of it log in.
 *
 * The very first account is made from ADMIN_USER and ADMIN_PASSWORD in
 * the environment, the first time somebody logs in with them while
 * the staff table is empty. After that those variables do nothing,
 * and people are added on the diary's Staff page.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db.ts";
import { getEnv } from "./env.ts";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export const SESSION_COOKIE = "qc_staff";
/** A fortnight: long enough not to nag a phone at the counter. */
export const SESSION_DAYS = 14;

export type Role = "owner" | "staff";

export interface Staff {
  id: number;
  username: string;
  name: string;
  role: Role;
  calendar_token: string;
}

// N=2^15 is OWASP's floor for scrypt and takes about 50ms , slow for
// somebody guessing, unnoticeable for somebody logging in.
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash!, "base64");
  const key = await scrypt(password.normalize("NFKC"), Buffer.from(salt!, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAXMEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Strings compared in constant time, for the environment fallback. */
function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** What a password must be. Long beats clever. */
export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Use at least 10 characters.";
  if (password.length > 200) return "That's longer than it needs to be , 200 characters at most.";
  return null;
}

export const USERNAME_RE = /^[a-z0-9._-]{2,40}$/;

/**
 * Checks a username and password. Returns the staff member, or null.
 *
 * A wrong username still costs one scrypt, so the time taken does not
 * say whether the account exists.
 */
export async function checkLogin(usernameRaw: string, password: string): Promise<Staff | null> {
  const username = usernameRaw.trim().toLowerCase();
  const row = await db
    .prepare(
      `SELECT id, username, name, role, calendar_token, password_hash
         FROM staff WHERE username = ?1 AND active`,
    )
    .bind(username)
    .first<Staff & { password_hash: string }>();

  if (row) {
    if (!(await verifyPassword(password, row.password_hash))) return null;
    const { password_hash: _, ...staff } = row;
    return staff;
  }

  await hashPassword(password); // the same cost as a real check
  return bootstrapOwner(username, password);
}

/**
 * The first login. While nobody is in the staff table, ADMIN_USER and
 * ADMIN_PASSWORD make the owner's account. Once anybody exists this
 * does nothing, so the environment variables cannot be used as a
 * back door later.
 */
async function bootstrapOwner(username: string, password: string): Promise<Staff | null> {
  const env = getEnv();
  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD) return null;
  if (!sameString(username, env.ADMIN_USER.trim().toLowerCase())) return null;
  if (!sameString(password, env.ADMIN_PASSWORD)) return null;
  if (!USERNAME_RE.test(username)) return null;

  const hash = await hashPassword(password);
  // Only inserts while the table is empty, so two people doing this at
  // once cannot make two owners.
  return db
    .prepare(
      `INSERT INTO staff (username, name, password_hash, role, calendar_token, created_at)
       SELECT ?1, ?2, ?3, 'owner', ?4, ?5
        WHERE NOT EXISTS (SELECT 1 FROM staff)
       RETURNING id, username, name, role, calendar_token`,
    )
    .bind(username, "Owner", hash, newToken(24), new Date().toISOString())
    .first<Staff>();
}

/** Starts a session and returns the cookie's value. */
export async function createSession(staffId: number, now = new Date()): Promise<string> {
  const token = newToken();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000);
  await db
    .prepare(
      `INSERT INTO staff_sessions (token_hash, staff_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(sha256(token), staffId, expires.toISOString(), now.toISOString())
    .run();
  // Tidy up this person's expired sessions while we are here.
  await db
    .prepare(`DELETE FROM staff_sessions WHERE staff_id = ?1 AND expires_at < ?2`)
    .bind(staffId, now.toISOString())
    .run();
  return token;
}

/** The staff member a session cookie belongs to, if it is still good. */
export async function staffForToken(token: string | undefined, now = new Date()): Promise<Staff | null> {
  if (!token || token.length > 100) return null;
  try {
    return await db
      .prepare(
        `SELECT s.id, s.username, s.name, s.role, s.calendar_token
           FROM staff_sessions x JOIN staff s ON s.id = x.staff_id
          WHERE x.token_hash = ?1 AND x.expires_at > ?2 AND s.active`,
      )
      .bind(sha256(token), now.toISOString())
      .first<Staff>();
  } catch (err) {
    console.error("session lookup failed", err);
    return null;
  }
}

export async function endSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await db.prepare(`DELETE FROM staff_sessions WHERE token_hash = ?1`).bind(sha256(token)).run();
}

/** Logs somebody out everywhere , after a password change, or when they leave. */
export async function endAllSessions(staffId: number): Promise<void> {
  await db.prepare(`DELETE FROM staff_sessions WHERE staff_id = ?1`).bind(staffId).run();
}

export const cookieOptions = (secure: boolean) => ({
  path: "/",
  httpOnly: true,
  secure,
  sameSite: "lax" as const,
  maxAge: SESSION_DAYS * 86_400,
});
