import { mkdirSync } from "node:fs";
import pg from "pg";
import { SUPABASE_ROOT_CA } from "./supabase-ca";
import type { Db } from "./types";

// Return DATE columns as 'YYYY-MM-DD' strings (never shifted by the server's time zone).
pg.types.setTypeParser(1082, (v: string) => v);

/**
 * TLS for Supabase hosts, verified against Supabase's own root CA (certificate
 * and host name). Any `sslmode` in the string is dropped so these settings apply.
 */
export function postgresConfig(connectionString: string): pg.PoolConfig {
  const url = new URL(connectionString);
  const supabase = /\.supabase\.(com|co)$/.test(url.hostname);
  if (supabase) url.searchParams.delete("sslmode");
  return {
    connectionString: url.toString(),
    ssl: supabase ? { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true } : undefined,
    // The Analytics page runs its reads in parallel. Kept small: Supabase's pooler caps
    // connections per project, and scripts and the Supabase dashboard need some too.
    max: 8,
    // Keep connections open between visits: a new one costs a TLS handshake.
    idleTimeoutMillis: 300_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    application_name: "spiral-os",
    // A runaway query fails instead of holding a connection forever.
    statement_timeout: 120_000,
  };
}

/** Supabase Postgres over a connection string (Railway). */
export function openPostgres(connectionString: string): Db {
  const pool = new pg.Pool(postgresConfig(connectionString));
  // An idle connection dropped by the server must not crash the process; the pool replaces it.
  pool.on("error", (error) => console.error("[db] idle connection error:", error.message));
  return {
    kind: "postgres",
    async query(text, params) {
      const res = await pool.query(text, params as unknown[] | undefined);
      return res.rows;
    },
    async exec(sql) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await fn({
          query: async (text, params) => (await client.query(text, params as unknown[] | undefined)).rows,
          exec: async (sql) => {
            await client.query(sql);
          },
        });
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

/** Embedded Postgres for local development and tests. `dataDir` undefined = in memory. */
export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const db = new PGlite(dataDir);
  await db.waitReady;
  const wrap = (q: Pick<typeof db, "query" | "exec">): Pick<Db, "query" | "exec"> => ({
    async query(text, params) {
      const res = await q.query(text, params as unknown[] | undefined);
      return res.rows as never[];
    },
    async exec(sql) {
      await q.exec(sql);
    },
  });
  return {
    kind: "pglite",
    ...wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
    close: () => db.close(),
  };
}
