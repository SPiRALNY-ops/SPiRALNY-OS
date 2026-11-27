import "server-only";
import { cacheLife } from "next/cache";
import { connection } from "next/server";
import { getDb, query } from "@/lib/db";
import { env } from "@/lib/env";
import { buildAnalytics } from "./build";
import { buildItem, type ItemKind } from "./items";
import { buildLong } from "./long";
import { RANGE_KEYS, todayIn } from "./range";
import type { AnalyticsView, ItemView, LongView, RangeKey } from "./types";

/**
 * Changes whenever the numbers can change. Every write to the analytics tables happens inside a
 * sync step, and each step records when it finished, so the newest finish time (plus the count of
 * finished runs) is a version. Steps still running don't count: a step that has started but not
 * finished must not clear the cache, or visitors would get views built from half-synced data.
 */
export const DATA_VERSION_SQL =
  "select coalesce(max(finished_at)::text, 'none') || '/' || count(*) as v from spiral.sync_runs where status <> 'running'";

async function dataVersion(): Promise<string> {
  const [row] = await query<{ v: string }>(DATA_VERSION_SQL);
  return row?.v ?? "none";
}

/**
 * The assembled view, kept in the server's memory. The key includes the day
 * and the data version, so a stored view is never served after new data or a
 * new day arrives; the lifetimes below only free memory from old entries.
 */
export async function cachedView(rangeKey: RangeKey, today: string, version: string): Promise<AnalyticsView> {
  "use cache";
  // The key already holds the day, so an entry is never needed past ~a day; expiring then frees memory.
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 108_000 });
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

/** The long view (trends that don't depend on the period), built once per day and data version. */
export async function cachedLong(today: string, version: string): Promise<LongView> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 108_000 });
  void version;
  return buildLong(await getDb(), today, env().TIMEZONE);
}

/** One page's or search's detail panel; fixed 16-month and 90-day windows, so no range in the key. */
export async function cachedItem(kind: ItemKind, id: string, today: string, version: string): Promise<ItemView | null> {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 108_000 });
  void version;
  return buildItem(await getDb(), kind, id, today);
}

/** The data version and today, for callers outside a page (the item route). */
export async function dataKey(): Promise<{ today: string; version: string }> {
  await connection();
  return { today: todayIn(env().TIMEZONE), version: await dataVersion() };
}

/**
 * Builds every view ahead of time (after a sync and when the server starts), so no visit waits:
 * 28 days first (the default), then the other ranges, then the long view.
 */
export async function warmAnalytics(): Promise<void> {
  const order: RangeKey[] = ["28d", ...RANGE_KEYS.filter((k) => k !== "28d")];
  for (const key of order) await getAnalytics(key);
  const { today, version } = await dataKey();
  await cachedLong(today, version);
}

export type * from "./types";
