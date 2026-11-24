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

  // Two rounds of reads, each run in parallel: first which sources are live and the days they
  // cover, then every section at once. Sections for sources that aren't live never touch the database.
  const [synced, skipped, coverage, coverageEnd] = await Promise.all([
    q.lastSuccessfulSyncs(db),
    q.skippedSources(db),
    d.coverage(db, timezone),
    d.coverageEnd(db),
  ]);
  const real = (s: SourceKey) => Boolean(synced[s]);
  const origin = (s: SourceKey): Origin => (real(s) ? "real" : "sample");
  const when = <T>(live: boolean, read: () => Promise<T>): Promise<T | null> => (live ? read() : Promise.resolve(null));

  // A source that is connected but has nothing yet is waiting for its first data, not for access.
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
  const gscReal = real("gsc");
  const ga4Real = real("ga4");
  const instantlyReal = real("instantly");
  /** A comparison is only fair if the source has data for the whole period before. */
  const comparable = (key: keyof typeof coverage) => Boolean(coverage[key] && coverage[key]! <= previous.start);

  const [
    leadBuckets,
    signupBuckets,
    leadsNow,
    leadsBefore,
    formsNow,
    formsBefore,
    unfinished,
    ga4Kpi,
    gscKpi,
    instantlyKpi,
    searchDaily,
    queryTotals,
    searchTotals,
    searchTotalsBefore,
    pageRows,
    pageGroups,
    planRows,
    leadStatusRows,
    websiteData,
    funnel,
    campaignRows,
    steps,
  ] = await Promise.all([
    when(leadsReal, () => q.bySource(db, range, timezone, "leads")),
    when(leadsReal, () => q.bySource(db, range, timezone, "signups")),
    when(leadsReal, () => q.leadTotals(db, current, timezone)),
    when(leadsReal, () => q.leadTotals(db, previous, timezone)),
    when(formsReal, () => q.formTotals(db, current, timezone)),
    when(formsReal, () => q.formTotals(db, previous, timezone)),
    when(formsReal, () => q.unfinishedDaily(db, current, timezone)),
    when(ga4Real, () => Promise.all([q.ga4Visits(db, current), q.ga4Visits(db, previous), q.ga4VisitsDaily(db, current)])),
    when(gscReal, () => Promise.all([q.gscClicks(db, current), q.gscClicks(db, previous)])),
    when(instantlyReal, () =>
      Promise.all([q.instantlyReplies(db, current), q.instantlyReplies(db, previous), q.instantlyRepliesDaily(db, current)]),
    ),
    when(gscReal, () => q.searchDaily(db, current)),
    when(gscReal, () => q.searchQueryTotals(db, current)),
    when(gscReal, () => d.searchTotals(db, current)),
    when(gscReal && comparable("gsc"), () => d.searchTotals(db, previous)),
    when(gscReal, () => q.pageRows(db, current, timezone, { withVisits: ga4Real, withForms: formsReal })),
    when(gscReal, () => d.pageGroups(db, current)),
    when(leadsReal, () => d.plans(db, current, timezone)),
    when(real("lead_sheet"), () => d.leadStatus(db, current)),
    when(ga4Real, () => d.website(db, current)),
    when(instantlyReal, () => d.coldFunnel(db, current)),
    when(instantlyReal, () => q.campaignRows(db, current, timezone, leadsReal)),
    when(instantlyReal, () => d.emailSteps(db, current)),
  ]);

  const leadsBySource = leadBuckets
    ? { origin: "real" as const, buckets: leadBuckets }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "leads") };
  const signupsBySource = signupBuckets
    ? { origin: "real" as const, buckets: signupBuckets }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "signups") };

  /** Buckets wholly before a source's first day or after its last are gaps, not zeros. */
  const withGaps = (trend: number[], key: keyof typeof coverage): (number | null)[] =>
    trend.map((v, i) => {
      const b = range.buckets[i];
      const first = coverage[key];
      const last = coverageEnd[key];
      return (first && b.end < first) || (last && b.start > last) ? null : v;
    });

  // KPIs: each tile follows its own source, trend line included.
  const sampleKpis = new Map(sample.sampleKpis(range).map((k) => [k.key, k]));
  const bucketTotals = (buckets: SourceBucket[]) => buckets.map((b) => LEAD_SOURCES.reduce((n, k) => n + b[k], 0));
  const kpis: Kpi[] = [];
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
      trend = sumIntoBuckets(range, unfinished ?? []);
    } else if (meta.source === "ga4" && ga4Kpi) {
      [value, before] = ga4Kpi;
      trend = sumIntoBuckets(range, ga4Kpi[2]);
    } else if (meta.source === "gsc" && gscKpi) {
      [value, before] = gscKpi;
      trend = sumIntoBuckets(range, (searchDaily ?? []).map((d) => [d.day, d.clicks] as [string, number]));
    } else if (meta.source === "instantly" && instantlyKpi) {
      [value, before] = instantlyKpi;
      trend = sumIntoBuckets(range, instantlyKpi[2]);
    }
    const coverageKey = isLeadCount ? "leads" : meta.source;
    kpis.push({ ...meta, value, previous: comparable(coverageKey) ? before : null, trend: withGaps(trend, coverageKey), origin: "real" });
  }

  const plans = planRows
    ? { origin: "real" as const, ...planRows }
    : { origin: "sample" as const, ...sample.samplePlans(range) };

  const leadStatus = leadStatusRows
    ? { origin: "real" as const, rows: leadStatusRows }
    : { origin: "sample" as const, rows: sample.sampleLeadStatus(range) };

  const pages =
    pageRows && pageGroups
      ? { origin: "real" as const, rows: pageRows, groups: pageGroups }
      : { origin: "sample" as const, rows: sample.samplePages(range), groups: sample.samplePageGroups(range) };

  const searches =
    gscReal && searchTotals && queryTotals
      ? {
          origin: "real" as const,
          daily: searchDaily ?? [],
          rows: q.topSearches(queryTotals),
          totals: searchTotals,
          previous: searchTotalsBefore,
          groups: d.searchGroups(queryTotals),
        }
      : {
          origin: "sample" as const,
          daily: sample.sampleSearchDaily(range),
          rows: sample.sampleSearches(range),
          ...sample.sampleSearchTotals(range),
          groups: sample.sampleSearchGroups(range),
        };

  const website = websiteData
    ? { origin: "real" as const, ...websiteData }
    : { origin: "sample" as const, ...sample.sampleWebsite(range) };

  const coldEmail: AnalyticsView["coldEmail"] = instantlyReal
    ? {
        origin: "real",
        rows: campaignRows ?? [],
        funnel: funnel?.funnel ?? [],
        health: funnel?.health ?? null,
        steps: steps ?? [],
      }
    : { origin: "sample", rows: sample.sampleCampaigns(range), ...sample.sampleColdFunnel(range) };

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
