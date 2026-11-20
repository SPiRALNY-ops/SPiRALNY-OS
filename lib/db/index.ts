import "server-only";
import { env, isProduction } from "@/lib/env";
import { openPglite, openPostgres } from "./drivers";
import { runMigrations } from "./migrate";
import type { Db } from "./types";

export type { Db } from "./types";

/**
 * One database handle per server process.
 *  - DATABASE_URL set (Railway -> Supabase): Postgres pool. Migrations are run
 *    deliberately with `npm run db:migrate`, never on boot.
 *  - DATABASE_URL unset (local dev): embedded Postgres in .data/pglite,
 *    migrated automatically on first use.
 */
const holder = globalThis as unknown as { __spiralDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  holder.__spiralDb ??= open().catch((error) => {
    holder.__spiralDb = undefined;
    throw error;
  });
  return holder.__spiralDb;
}

async function open(): Promise<Db> {
  const url = env().DATABASE_URL;
  if (url) return openPostgres(url);
  if (isProduction()) throw new Error("DATABASE_URL is not set.");
  const db = await openPglite(".data/pglite");
  await runMigrations(db, { local: true });
  return db;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  return (await getDb()).query<T>(text, params);
}
