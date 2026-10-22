/**
 * The database: Postgres, on Supabase.
 *
 * This wrapper deliberately keeps the shape the site already used —
 * prepare().bind().first()/all()/run(), and a batch() that is a real
 * transaction. That is not nostalgia for the old host: it means the
 * thirteen SQL statements in this codebase read exactly as they did
 * when they were reviewed, and the only thing that changed is where
 * they run.
 *
 * Placeholders are written ?1, ?2 in the call sites and rewritten to
 * Postgres's $1, $2 here, so no query had to be edited by hand.
 */

import postgres from "postgres";

/** process.env at runtime; import.meta.env is the .env file in dev. */
export function envVar(name: string): string | undefined {
  const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
  if (fromProcess) return fromProcess;
  return (import.meta.env as Record<string, string | undefined>)[name];
}

let client: postgres.Sql | null = null;

/**
 * One lazily-made client per warm instance. Supabase's pooler is what
 * actually manages concurrency, so a serverless invocation needs a
 * single connection, not a pool of its own.
 */
function sql(): postgres.Sql {
  if (client) return client;

  const url = envVar("DATABASE_URL");
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and paste the Supabase connection string.",
    );
  }

  client = postgres(url, {
    // Supabase's pooler runs in transaction mode, which cannot keep a
    // prepared statement alive between queries. Without this, every
    // second request fails with "prepared statement already exists".
    prepare: false,
    // One per serverless instance; the long-lived dev server serves a
    // whole browser's worth of requests at once, so it gets a few.
    max: import.meta.env.DEV ? 4 : 1,
    idle_timeout: 20,
    connect_timeout: 15,
  });
  return client;
}

/** Longest any query or transaction may take before we give up. */
const QUERY_TIMEOUT_MS = 12_000;

/**
 * A connection the pooler has silently dropped never answers, and
 * every request queued behind it would wait forever — the site just
 * stops loading. So a query that runs too long fails, the client is
 * thrown away, and the next request connects afresh.
 */
async function guard<T>(work: (s: postgres.Sql) => Promise<T>): Promise<T> {
  const s = sql();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (client === s) client = null;
      void s.end({ timeout: 0 }).catch(() => {});
      reject(new Error(`Database did not answer within ${QUERY_TIMEOUT_MS / 1000}s`));
    }, QUERY_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work(s), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** True when the site has somewhere to read bookings from. */
export const hasDatabase = () => Boolean(envVar("DATABASE_URL"));

/** ?1 ?2 → $1 $2. Postgres numbers its placeholders the same way. */
const toPg = (text: string) => text.replace(/\?(\d+)/g, "$$$1");

export class Statement {
  readonly text: string;
  params: unknown[] = [];

  constructor(text: string) {
    this.text = toPg(text);
  }

  bind(...values: unknown[]): Statement {
    this.params = values;
    return this;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    const rows = await guard((s) => s.unsafe(this.text, this.params as never[]));
    return { results: rows as unknown as T[] };
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const rows = await guard((s) => s.unsafe(this.text, this.params as never[]));
    return ((rows as unknown as T[])[0] ?? null) as T | null;
  }

  async run(): Promise<void> {
    await guard((s) => s.unsafe(this.text, this.params as never[]));
  }
}

export const db = {
  prepare: (text: string) => new Statement(text),

  /**
   * All of them or none of them. The booking insert and its referral
   * code are written together — a booking without its code would be a
   * customer promised a discount the shop cannot find.
   *
   * Returns each statement's rows, in order, for the ones that use
   * RETURNING or SELECT.
   */
  async batch(statements: Statement[]): Promise<Record<string, unknown>[][]> {
    return guard((s) => s.begin(async (tx) => {
      const out: Record<string, unknown>[][] = [];
      for (const s of statements) {
        out.push((await tx.unsafe(s.text, s.params as never[])) as unknown as Record<string, unknown>[]);
      }
      return out;
    }) as Promise<Record<string, unknown>[][]>);
  },
};
