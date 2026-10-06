import { readFileSync } from "node:fs";
import postgres from "postgres";

/**
 * A short-lived connection to the test database, for the few tests
 * that need to know what the shop has set — a window's capacity, say —
 * rather than assume it.
 */
export async function withDb<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  let url = process.env.DATABASE_URL;
  if (!url) {
    const text = readFileSync(new URL("../../.env", import.meta.url), "utf8");
    url = /^\s*DATABASE_URL\s*=\s*(.+)$/m.exec(text)?.[1]?.replace(/^["']|["']$/g, "").trim();
  }
  if (!url) throw new Error("No DATABASE_URL. Copy .env.example to .env first.");

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 20, onnotice: () => {} });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** How many measures a window takes, from the settings table. */
export const capacityOf = (slot: "am" | "pm" | "eve") =>
  withDb(async (sql) => {
    const [row] = await sql.unsafe(`SELECT capacity_${slot} AS n FROM settings WHERE id = 1`);
    return Number(row?.n ?? 0);
  });
