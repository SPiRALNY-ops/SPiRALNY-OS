/**
 * Assembles the Analytics view. A source counts as connected ("real") once it
 * has at least one successful sync; until then its sections show sample data.
 * Real and sample numbers are never mixed inside one section — a real section
 * shows "—" for columns whose source isn't connected yet.
 */
import type { Db } from "@/lib/db/types";
import * as q from "./queries";
import { resolveRange, sumIntoBuckets } from "./range";
import * as sample from "./sample";
import { LEAD_SOURCES, type AnalyticsView, type Kpi, type Origin, type RangeKey, type SourceBucket, type SourceKey, type SourceStatus } from "./types";

/** `waitingFor` completes the sentence "Waiting for …". */
const SOURCE_INFO: Record<SourceKey, { label: string; waitingFor: string }> = {
  forms: { label: "Sign-up forms", waitingFor: "website access" },
  ga4: { label: "Google Analytics", waitingFor: "access and the tracking code" },
  gsc: { label: "Search Console", waitingFor: "access" },
  instantly: { label: "Instantly", waitingFor: "the API key" },
};

export async function buildAnalytics(
  db: Db,
  rangeKey: RangeKey,
  today: string,
  timezone: string,
): Promise<AnalyticsView> {
  const range = resolveRange(rangeKey, today);
  const current = { start: range.start, end: range.end };
  const previous = { start: range.previousStart, end: range.previousEnd };

  const synced = await q.lastSuccessfulSyncs(db);
  const real = (s: SourceKey) => Boolean(synced[s]);
  const origin = (s: SourceKey): Origin => (real(s) ? "real" : "sample");

  const sources: SourceStatus[] = (Object.keys(SOURCE_INFO) as SourceKey[]).map((key) => ({
    key,
    ...SOURCE_INFO[key],
    origin: origin(key),
    lastSuccessAt: synced[key] ?? null,
  }));

  const formsReal = real("forms");
  const leadsBySource = formsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "leads") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "leads") };
  const signupsBySource = formsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "signups") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "signups") };

  const searchDaily = real("gsc") ? await q.searchDaily(db, current) : null;

  // KPIs: each tile follows its own source, trend line included.
  const sampleKpis = new Map(sample.sampleKpis(range).map((k) => [k.key, k]));
  const bucketTotals = (buckets: SourceBucket[]) => buckets.map((b) => LEAD_SOURCES.reduce((n, k) => n + b[k], 0));
  const kpis: Kpi[] = [];
  const [formsNow, formsBefore] = formsReal
    ? await Promise.all([q.formTotals(db, current, timezone), q.formTotals(db, previous, timezone)])
    : [null, null];
  for (const meta of sample.KPI_META) {
    if (!real(meta.source)) {
      kpis.push(sampleKpis.get(meta.key)!);
      continue;
    }
    let value = 0;
    let before = 0;
    let trend: number[] = range.buckets.map(() => 0);
    if (meta.source === "forms" && formsNow && formsBefore) {
      const k = meta.key as "leads" | "signups" | "unfinished";
      value = formsNow[k];
      before = formsBefore[k];
      trend =
        k === "leads"
          ? bucketTotals(leadsBySource.buckets)
          : k === "signups"
            ? bucketTotals(signupsBySource.buckets)
            : sumIntoBuckets(range, await q.unfinishedDaily(db, current, timezone));
    } else if (meta.source === "ga4") {
      [value, before] = await Promise.all([q.ga4Visits(db, current), q.ga4Visits(db, previous)]);
      trend = sumIntoBuckets(range, await q.ga4VisitsDaily(db, current));
    } else if (meta.source === "gsc") {
      [value, before] = await Promise.all([q.gscClicks(db, current), q.gscClicks(db, previous)]);
      trend = sumIntoBuckets(range, (searchDaily ?? []).map((d) => [d.day, d.clicks] as [string, number]));
    } else if (meta.source === "instantly") {
      [value, before] = await Promise.all([q.instantlyReplies(db, current), q.instantlyReplies(db, previous)]);
      trend = sumIntoBuckets(range, await q.instantlyRepliesDaily(db, current));
    }
    kpis.push({ ...meta, value, previous: before, trend, origin: "real" });
  }

  const gscReal = real("gsc");
  const pages = gscReal
    ? {
        origin: "real" as const,
        rows: await q.pageRows(db, current, timezone, { withVisits: real("ga4"), withForms: formsReal }),
      }
    : { origin: "sample" as const, rows: sample.samplePages(range) };

  const searches = gscReal
    ? {
        origin: "real" as const,
        daily: searchDaily ?? [],
        rows: await q.topSearches(db, current),
      }
    : { origin: "sample" as const, daily: sample.sampleSearchDaily(range), rows: sample.sampleSearches(range) };

  const coldEmail = real("instantly")
    ? { origin: "real" as const, rows: await q.campaignRows(db, current, timezone, formsReal) }
    : { origin: "sample" as const, rows: sample.sampleCampaigns(range) };

  return { range, timezone, sources, kpis, leadsBySource, signupsBySource, pages, searches, coldEmail };
}
