import { mkdirSync } from "node:fs";
import pg from "pg";
import type { Db } from "./types";

// Return DATE columns as 'YYYY-MM-DD' strings (never shifted by the server's time zone).
pg.types.setTypeParser(1082, (v: string) => v);

/** Supabase Postgres over a connection string (Railway). */
export function openPostgres(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5, idleTimeoutMillis: 30_000 });
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
