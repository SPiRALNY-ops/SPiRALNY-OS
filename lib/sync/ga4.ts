/**
 * Google Analytics 4 -> spiral.ga4_daily. GA4 is new on spiralny.com, so the
 * first run simply asks for two years and gets whatever exists; later runs
 * re-read the last few days while Google finishes processing them.
 */
import { addDays } from "@/lib/analytics/range";
import { fetchGa4Daily, fetchGa4SiteDaily } from "@/lib/sources/ga4";
import { hasRows, insertRows, lastSyncedThrough } from "./store";
import type { SourceResult, SyncContext } from "./types";

const BACKFILL_DAYS = 760;
const LOOKBACK_DAYS = 3;

export async function syncGa4(ctx: SyncContext): Promise<SourceResult> {
  const { db, config, today } = ctx;
  const token = await ctx.googleToken!();
  // Backfill again if the site totals table is new (added after the first syncs).
  const through = (await hasRows(db, "spiral.ga4_daily_site")) ? await lastSyncedThrough(db, "ga4") : null;
  const start = through ? addDays(through, -LOOKBACK_DAYS) : addDays(today, -BACKFILL_DAYS);
  const end = addDays(today, -1);

  const [rows, totals] = await Promise.all([
    fetchGa4Daily(ctx.fetch, token, config.ga4PropertyId!, start, end),
    fetchGa4SiteDaily(ctx.fetch, token, config.ga4PropertyId!, start, end),
  ]);
  await db.transaction(async (tx) => {
    await tx.query("delete from spiral.ga4_daily where day between $1::date and $2::date", [start, end]);
    await tx.query("delete from spiral.ga4_daily_site where day between $1::date and $2::date", [start, end]);
    await insertRows(
      tx,
      "spiral.ga4_daily_site",
      [["day", "date"], ["sessions", "integer"], ["engaged_sessions", "integer"], ["users", "integer"]],
      totals,
      "on conflict do nothing",
    );
    await insertRows(
      tx,
      "spiral.ga4_daily",
      [
        ["day", "date"],
        ["landing_page", "text"],
        ["channel_group", "text"],
        ["source", "text"],
        ["medium", "text"],
        ["device", "text"],
        ["sessions", "integer"],
        ["engaged_sessions", "integer"],
        ["users", "integer"],
      ],
      rows,
    );
  });

  if (!(await hasRows(db, "spiral.ga4_daily_site"))) {
    return {
      status: "skipped",
      rows: 0,
      message: "Google Analytics is connected but has no visits yet. Is the tracking code on spiralny.com?",
    };
  }
  return { status: "success", rows: rows.length, rangeStart: start, rangeEnd: end };
}
