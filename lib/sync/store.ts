/** Database helpers shared by the sync steps. */
import type { Db } from "@/lib/db/types";
import type { RunSummary, SourceResult, SyncSource } from "./types";

type Tx = Pick<Db, "query" | "exec">;

/**
 * Bulk insert through one JSON parameter (works the same on Supabase and the
 * embedded database). `columns` are [name, postgres type] pairs.
 */
export async function insertRows(
  tx: Tx,
  table: string,
  columns: [string, string][],
  rows: Record<string, unknown>[],
  onConflict = "",
): Promise<number> {
  const names = columns.map(([n]) => n).join(", ");
  const defs = columns.map(([n, t]) => `${n} ${t}`).join(", ");
  for (let i = 0; i < rows.length; i += 2000) {
    const chunk = rows.slice(i, i + 2000);
    await tx.query(
      `insert into ${table} (${names}) select ${names} from jsonb_to_recordset($1::jsonb) as x(${defs}) ${onConflict}`,
      [JSON.stringify(chunk)],
    );
  }
  return rows.length;
}

/** End date of the last successful run, so the next run only re-reads recent days. */
export async function lastSyncedThrough(db: Pick<Db, "query">, source: SyncSource): Promise<string | null> {
  const [row] = await db.query<{ d: string | null }>(
    "select max(range_end)::text as d from spiral.sync_runs where source = $1 and status = 'success'",
    [source],
  );
  return row?.d ?? null;
}

export async function hasRows(db: Pick<Db, "query">, table: string): Promise<boolean> {
  const [row] = await db.query<{ any: boolean }>(`select exists (select 1 from ${table}) as any`);
  return Boolean(row?.any);
}

/** Runs one source and logs it in spiral.sync_runs (which drives "last updated" and real-vs-sample). */
export async function recordRun(
  db: Pick<Db, "query">,
  source: SyncSource,
  fn: () => Promise<SourceResult>,
): Promise<RunSummary> {
  const [run] = await db.query<{ id: number }>(
    "insert into spiral.sync_runs (source, status) values ($1, 'running') returning id",
    [source],
  );
  try {
    const result = await fn();
    await db.query(
      `update spiral.sync_runs
          set status = $2, finished_at = now(), rows_written = $3, range_start = $4::date, range_end = $5::date, message = $6
        where id = $1`,
      [run.id, result.status, result.rows, result.rangeStart ?? null, result.rangeEnd ?? null, result.message ?? null],
    );
    return { source, status: result.status, rows: result.rows, message: result.message };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await db.query(
      "update spiral.sync_runs set status = 'error', finished_at = now(), message = $2 where id = $1",
      [run.id, message],
    );
    return { source, status: "error", rows: 0, message };
  }
}

/** A run left "running" by a restart would block nothing, but would look stuck; close it. */
export async function closeStaleRuns(db: Pick<Db, "query">): Promise<void> {
  await db.query(
    `update spiral.sync_runs set status = 'error', finished_at = now(), message = 'Interrupted (the server restarted).'
      where status = 'running' and started_at < now() - interval '2 hours'`,
  );
}
