import { afterEach, describe, expect, it } from "vitest";
import { openPglite } from "./drivers";
import { listMigrations, runMigrations } from "./migrate";
import type { Db } from "./types";

let db: Db | undefined;
afterEach(async () => {
  await db?.close();
  db = undefined;
});

describe("migrations", () => {
  it("apply in order and are safe to run twice", async () => {
    db = await openPglite();
    const first = await runMigrations(db, { local: true });
    expect(first).toEqual(listMigrations().map((m) => m.name));
    expect(await runMigrations(db, { local: true })).toEqual([]);

    // Running every file again directly must not fail either (idempotent SQL).
    for (const m of listMigrations()) await db.exec(m.sql);
  });

  it("keeps every table in the spiral schema with row-level security on", async () => {
    db = await openPglite();
    await runMigrations(db, { local: true });
    const tables = await db.query<{ table_name: string; rls: boolean }>(`
      select c.relname as table_name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'spiral' and c.relkind = 'r'
      order by 1`);
    expect(tables.map((t) => t.table_name)).toEqual(
      expect.arrayContaining([
        "profiles",
        "people",
        "integrations",
        "sync_runs",
        "form_entries",
        "ga4_daily",
        "gsc_daily",
        "gsc_daily_page",
        "instantly_campaigns",
        "instantly_campaign_daily",
        "instantly_leads",
      ]),
    );
    expect(tables.filter((t) => !t.rls)).toEqual([]);

    const publicTables = await db.query(
      "select tablename from pg_tables where schemaname = 'public'",
    );
    expect(publicTables).toEqual([]);
  });

  it("gives the browser roles no access to spiral tables", async () => {
    db = await openPglite();
    await runMigrations(db, { local: true });
    const grants = await db.query(`
      select grantee, table_name from information_schema.role_table_grants
      where table_schema = 'spiral' and grantee in ('anon', 'authenticated')`);
    expect(grants).toEqual([]);
  });

  it("matches people by email case-insensitively", async () => {
    db = await openPglite();
    await runMigrations(db, { local: true });
    await db.query("insert into spiral.people (email) values ($1)", ["Agent@Example.com"]);
    await expect(
      db.query("insert into spiral.people (email) values ($1)", ["agent@example.com"]),
    ).rejects.toThrow();
  });
});
