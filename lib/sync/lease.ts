/**
 * One sync at a time, across servers: a row in spiral.sync_state that a sync holds while it runs
 * and renews after every step (a heartbeat). During a deploy the old and the new server overlap
 * for a while, and an in-memory lock can't see the other one; the database can. A lease that
 * isn't renewed (the server died mid-run) expires, and the next sync takes over.
 */
import { randomUUID } from "node:crypto";
import type { Db } from "@/lib/db/types";

const KEY = "sync_lease";
/** Longer than any single step takes (the first Search Console backfill is the slowest). */
export const LEASE_MINUTES = 15;

export type Lease = { holder: string };

/** Takes the lease if nobody holds a live one; null when another sync is running. */
export async function acquireLease(db: Pick<Db, "query">): Promise<Lease | null> {
  const holder = randomUUID();
  const rows = await db.query<{ value: string }>(
    `insert into spiral.sync_state (key, value, expires_at, updated_at)
     values ($1, $2, now() + make_interval(mins => $3), now())
     on conflict (key) do update set value = excluded.value, expires_at = excluded.expires_at, updated_at = now()
      where spiral.sync_state.expires_at is null or spiral.sync_state.expires_at <= now()
     returning value`,
    [KEY, holder, LEASE_MINUTES],
  );
  return rows[0]?.value === holder ? { holder } : null;
}

/** The heartbeat: pushes the expiry out again. */
export async function renewLease(db: Pick<Db, "query">, lease: Lease): Promise<void> {
  await db.query(
    "update spiral.sync_state set expires_at = now() + make_interval(mins => $3), updated_at = now() where key = $1 and value = $2",
    [KEY, lease.holder, LEASE_MINUTES],
  );
}

export async function releaseLease(db: Pick<Db, "query">, lease: Lease): Promise<void> {
  // In the past, so a sync started the very next moment can take it.
  await db.query("update spiral.sync_state set expires_at = now() - interval '1 second', updated_at = now() where key = $1 and value = $2", [
    KEY,
    lease.holder,
  ]);
}

/** Progress markers for data read a little at a time (a cursor, or the last day stored). */
export async function readMarker(db: Pick<Db, "query">, key: string): Promise<string | null> {
  const [row] = await db.query<{ value: string | null }>("select value from spiral.sync_state where key = $1", [key]);
  return row?.value ?? null;
}

export async function writeMarker(db: Pick<Db, "query">, key: string, value: string): Promise<void> {
  await db.query(
    `insert into spiral.sync_state (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, value],
  );
}
