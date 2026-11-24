import "server-only";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { getDb, query } from "@/lib/db";
import { env } from "@/lib/env";
import { buildAnalytics } from "./build";
import { RANGE_KEYS, todayIn } from "./range";
import type { AnalyticsView, RangeKey } from "./types";

/**
 * Changes whenever the numbers can change. Every write to the analytics tables
 * happens inside a sync step, and each step records when it started and
 * finished, so the newest of those times (plus the run count) is a version.
 */
async function dataVersion(): Promise<string> {
  const [row] = await query<{ v: string }>(
    "select coalesce(max(greatest(started_at, finished_at))::text, 'none') || '/' || count(*) as v from spiral.sync_runs",
  );
  return row?.v ?? "none";
}

/**
 * The assembled view, kept in the server's memory. The key includes the day
 * and the data version, so a stored view is never served after new data or a
 * new day arrives; the lifetimes below only free memory from old entries.
 */
export async function cachedView(rangeKey: RangeKey, today: string, version: string): Promise<AnalyticsView> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 172_800 });
  void version; // part of the cache key only
  return buildAnalytics(await getDb(), rangeKey, today, env().TIMEZONE);
}

/** What the page needs to fetch (or reuse) a view: the range, today in New York, and the data version. */
export async function viewKey(rangeKey: RangeKey): Promise<{ rangeKey: RangeKey; today: string; version: string }> {
  await connection();
  return { rangeKey, today: todayIn(env().TIMEZONE), version: await dataVersion() };
}

/** Analytics for the signed-in owner, from the cache when the data hasn't changed. */
export async function getAnalytics(rangeKey: RangeKey): Promise<AnalyticsView> {
  const key = await viewKey(rangeKey);
  return cachedView(key.rangeKey, key.today, key.version);
}

/** Builds every range ahead of time (after a sync and when the server starts), so no visit waits. */
export async function warmAnalytics(): Promise<void> {
  for (const key of RANGE_KEYS) await getAnalytics(key);
}

export type * from "./types";
