import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "./types";

// Read at runtime only (local dev and `npm run db:migrate`); kept out of the production bundle trace.
export const MIGRATIONS_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "supabase", "migrations");

/**
 * Roles that hosted Supabase already has. Created only on the local embedded
 * database so the same migrations (which revoke access from these roles) run
 * unchanged in both places.
 */
const LOCAL_SUPABASE_ROLES = `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;
`;

export function listMigrations(dir = MIGRATIONS_DIR): { name: string; sql: string }[] {
  return readdirSync(dir)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
}

/** Applies every migration not yet recorded in spiral.app_migrations, in order, each in its own transaction. */
export async function runMigrations(db: Db, opts: { local?: boolean; dir?: string } = {}): Promise<string[]> {
  if (opts.local) await db.exec(LOCAL_SUPABASE_ROLES);
  await db.exec(`
    create schema if not exists spiral;
    create table if not exists spiral.app_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    );
    alter table spiral.app_migrations enable row level security;
  `);
  const done = new Set(
    (await db.query<{ name: string }>("select name from spiral.app_migrations")).map((r) => r.name),
  );
  const applied: string[] = [];
  for (const m of listMigrations(opts.dir)) {
    if (done.has(m.name)) continue;
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query("insert into spiral.app_migrations (name) values ($1)", [m.name]);
    });
    applied.push(m.name);
  }
  return applied;
}
