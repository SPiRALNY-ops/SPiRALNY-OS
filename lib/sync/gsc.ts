/**
 * Search Console -> spiral.gsc_daily (search x page) and spiral.gsc_daily_page
 * (page totals, which also count the searches Google leaves out of the first).
 * First run backfills the 16 months Google keeps; later runs re-read the last
 * few days, because Search Console finalises data with a delay.
 */
import { addDays } from "@/lib/analytics/range";
import { fetchGscDaily, listSites, pickSpiralSite } from "@/lib/sources/gsc";
import { hasRows, insertRows, lastSyncedThrough } from "./store";
import type { SourceResult, SyncContext } from "./types";

const BACKFILL_DAYS = 486; // ~16 months
const LOOKBACK_DAYS = 5;
const CHUNK_DAYS = 30;

export async function syncGsc(ctx: SyncContext): Promise<SourceResult> {
  const { db, config, today } = ctx;
  const token = await ctx.googleToken!();
  const site = config.gscSiteUrl ?? pickSpiralSite(await listSites(ctx.fetch, token));
  if (!site) {
    return {
      status: "skipped",
      rows: 0,
      message: "The connected Google account can't see a spiralny.com property in Search Console yet.",
    };
  }
  // Backfill again if the site totals table is new (added after the first syncs).
  const through = (await hasRows(db, "spiral.gsc_daily_site")) ? await lastSyncedThrough(db, "gsc") : null;
  const start = through ? addDays(through, -LOOKBACK_DAYS) : addDays(today, -BACKFILL_DAYS);
  const end = addDays(today, -1);

  let written = 0;
  for (let from = start; from <= end; from = addDays(from, CHUNK_DAYS)) {
    const to = addDays(from, CHUNK_DAYS - 1) < end ? addDays(from, CHUNK_DAYS - 1) : end;
    const { queries, pages, site: totals } = await fetchGscDaily(ctx.fetch, token, site, from, to);
    await db.transaction(async (tx) => {
      await tx.query("delete from spiral.gsc_daily where day between $1::date and $2::date", [from, to]);
      await tx.query("delete from spiral.gsc_daily_page where day between $1::date and $2::date", [from, to]);
      await tx.query("delete from spiral.gsc_daily_site where day between $1::date and $2::date", [from, to]);
      await insertRows(
        tx,
        "spiral.gsc_daily_site",
        [["day", "date"], ["clicks", "integer"], ["impressions", "integer"], ["position", "real"]],
        totals,
        "on conflict do nothing",
      );
      written += await insertRows(
        tx,
        "spiral.gsc_daily",
        [["day", "date"], ["query", "text"], ["page", "text"], ["clicks", "integer"], ["impressions", "integer"], ["position", "real"]],
        queries,
        "on conflict do nothing",
      );
      written += await insertRows(
        tx,
        "spiral.gsc_daily_page",
        [["day", "date"], ["page", "text"], ["clicks", "integer"], ["impressions", "integer"], ["position", "real"]],
        pages,
        "on conflict do nothing",
      );
    });
  }

  if (!(await hasRows(db, "spiral.gsc_daily_site"))) {
    return { status: "skipped", rows: 0, message: `Search Console returned no data for ${site} yet.` };
  }
  return { status: "success", rows: written, rangeStart: start, rangeEnd: end, message: `Property ${site}.` };
}
