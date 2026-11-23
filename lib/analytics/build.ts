/**
 * Assembles the Analytics view. A source counts as connected ("real") once it
 * has at least one successful sync; until then its sections show sample data.
 * Real and sample numbers are never mixed inside one section — a real section
 * shows "—" for columns whose source isn't connected yet.
 */
import type { Db } from "@/lib/db/types";
import * as d from "./details";
import * as q from "./queries";
import { resolveRange, sumIntoBuckets } from "./range";
import * as sample from "./sample";
import { LEAD_SOURCES, type AnalyticsView, type Kpi, type Origin, type RangeKey, type SourceBucket, type SourceKey, type SourceStatus } from "./types";

/** `waitingFor` completes the sentence "Waiting for …". */
const SOURCE_INFO: Record<SourceKey, { label: string; waitingFor: string }> = {
  forms: { label: "Sign-up forms", waitingFor: "website access" },
  lead_sheet: { label: "Lead sheet", waitingFor: "Google sign-in" },
  ga4: { label: "Google Analytics", waitingFor: "access and the tracking code" },
  gsc: { label: "Search Console", waitingFor: "access" },
  instantly: { label: "Instantly", waitingFor: "the API key" },
};

/** What a connected source is waiting for when its last sync found nothing yet. */
const FIRST_DATA: Record<SourceKey, string> = {
  forms: "the first form entry (notifications are set up)",
  lead_sheet: "the first dated row on the lead sheet",
  ga4: "the first visits to be recorded",
  gsc: "Search Console data for spiralny.com",
  instantly: "the first campaign",
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

  // A source that is connected but has nothing yet is waiting for its first data, not for access.
  const skipped = await q.skippedSources(db);
  const sources: SourceStatus[] = (Object.keys(SOURCE_INFO) as SourceKey[]).map((key) => ({
    key,
    ...SOURCE_INFO[key],
    waitingFor: !synced[key] && skipped.has(key) ? FIRST_DATA[key] : SOURCE_INFO[key].waitingFor,
    origin: origin(key),
    lastSuccessAt: synced[key] ?? null,
  }));

  const formsReal = real("forms");
  // Leads and sign-ups come from the forms and the lead sheet; either one makes them real.
  const leadsReal = formsReal || real("lead_sheet");
  const leadsBySource = leadsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "leads") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "leads") };
  const signupsBySource = leadsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "signups") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "signups") };

  const searchDaily = real("gsc") ? await q.searchDaily(db, current) : null;
  const coverage = await d.coverage(db, timezone);
  const coverageEnd = await d.coverageEnd(db);
  /** Buckets wholly before a source's first day or after its last are gaps, not zeros. */
  const withGaps = (trend: number[], key: keyof typeof coverage): (number | null)[] =>
    trend.map((v, i) => {
      const b = range.buckets[i];
      const first = coverage[key];
      const last = coverageEnd[key];
      return (first && b.end < first) || (last && b.start > last) ? null : v;
    });
  /** A comparison is only fair if the source has data for the whole period before. */
  const comparable = (key: keyof typeof coverage) => Boolean(coverage[key] && coverage[key]! <= previous.start);

  // KPIs: each tile follows its own source, trend line included.
  const sampleKpis = new Map(sample.sampleKpis(range).map((k) => [k.key, k]));
  const bucketTotals = (buckets: SourceBucket[]) => buckets.map((b) => LEAD_SOURCES.reduce((n, k) => n + b[k], 0));
  const kpis: Kpi[] = [];
  const [leadsNow, leadsBefore] = leadsReal
    ? await Promise.all([q.leadTotals(db, current, timezone), q.leadTotals(db, previous, timezone)])
    : [null, null];
  const [formsNow, formsBefore] = formsReal
    ? await Promise.all([q.formTotals(db, current, timezone), q.formTotals(db, previous, timezone)])
    : [null, null];
  for (const meta of sample.KPI_META) {
    const isLeadCount = meta.key === "leads" || meta.key === "signups";
    if (isLeadCount ? !leadsReal : !real(meta.source)) {
      kpis.push(sampleKpis.get(meta.key)!);
      continue;
    }
    let value = 0;
    let before = 0;
    let trend: number[] = range.buckets.map(() => 0);
    if (isLeadCount && leadsNow && leadsBefore) {
      const k = meta.key as "leads" | "signups";
      value = leadsNow[k];
      before = leadsBefore[k];
      trend = bucketTotals(k === "leads" ? leadsBySource.buckets : signupsBySource.buckets);
    } else if (meta.key === "unfinished" && formsNow && formsBefore) {
      value = formsNow.unfinished;
      before = formsBefore.unfinished;
      trend = sumIntoBuckets(range, await q.unfinishedDaily(db, current, timezone));
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
    const coverageKey = isLeadCount ? "leads" : meta.source;
    kpis.push({ ...meta, value, previous: comparable(coverageKey) ? before : null, trend: withGaps(trend, coverageKey), origin: "real" });
  }

  const plans = leadsReal
    ? { origin: "real" as const, ...(await d.plans(db, current, timezone)) }
    : { origin: "sample" as const, ...sample.samplePlans(range) };

  const leadStatus = real("lead_sheet")
    ? { origin: "real" as const, rows: await d.leadStatus(db, current) }
    : { origin: "sample" as const, rows: sample.sampleLeadStatus(range) };

  const gscReal = real("gsc");
  const pages = gscReal
    ? {
        origin: "real" as const,
        rows: await q.pageRows(db, current, timezone, { withVisits: real("ga4"), withForms: formsReal }),
        groups: await d.pageGroups(db, current),
      }
    : { origin: "sample" as const, rows: sample.samplePages(range), groups: sample.samplePageGroups(range) };

  const searches = gscReal
    ? {
        origin: "real" as const,
        daily: searchDaily ?? [],
        rows: await q.topSearches(db, current),
        totals: await d.searchTotals(db, current),
        previous: comparable("gsc") ? await d.searchTotals(db, previous) : null,
        groups: await d.searchGroups(db, current),
      }
    : {
        origin: "sample" as const,
        daily: sample.sampleSearchDaily(range),
        rows: sample.sampleSearches(range),
        ...sample.sampleSearchTotals(range),
        groups: sample.sampleSearchGroups(range),
      };

  const website = real("ga4")
    ? { origin: "real" as const, ...(await d.website(db, current)) }
    : { origin: "sample" as const, ...sample.sampleWebsite(range) };

  let coldEmail: AnalyticsView["coldEmail"];
  if (real("instantly")) {
    const funnel = await d.coldFunnel(db, current);
    coldEmail = {
      origin: "real",
      rows: await q.campaignRows(db, current, timezone, leadsReal),
      funnel: funnel?.funnel ?? [],
      health: funnel?.health ?? null,
      steps: await d.emailSteps(db, current),
    };
  } else {
    coldEmail = { origin: "sample", rows: sample.sampleCampaigns(range), ...sample.sampleColdFunnel(range) };
  }

  return {
    range,
    timezone,
    sources,
    kpis,
    leadsBySource,
    signupsBySource,
    plans,
    leadStatus,
    pages,
    searches,
    website,
    coldEmail,
    coverage,
    coverageEnd,
  };
}
