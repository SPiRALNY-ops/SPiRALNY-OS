/**
 * Assembles the Analytics view. A source counts as connected ("real") once it
 * has at least one successful sync; until then its sections show sample data.
 * Real and sample numbers are never mixed inside one section — a real section
 * shows "—" for columns whose source isn't connected yet.
 */
import type { Db } from "@/lib/db/types";
import * as q from "./queries";
import { resolveRange } from "./range";
import * as sample from "./sample";
import type { AnalyticsView, Kpi, Origin, RangeKey, SourceKey, SourceStatus } from "./types";

/** `waitingFor` completes the sentence "waiting for …". */
const SOURCE_INFO: Record<SourceKey, { label: string; waitingFor: string }> = {
  forms: {
    label: "Sign-up form entries",
    waitingFor: "website access, so each form entry is sent to Spiral OS",
  },
  ga4: {
    label: "Google Analytics",
    waitingFor: "Google Analytics access and the tracking code on spiralny.com",
  },
  gsc: {
    label: "Google Search Console",
    waitingFor: "Search Console access",
  },
  instantly: {
    label: "Instantly",
    waitingFor: "the Instantly API key",
  },
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

  // KPIs: each tile follows its own source.
  const sampleKpis = new Map(sample.sampleKpis(range).map((k) => [k.key, k]));
  const kpis: Kpi[] = [];
  const [formsNow, formsBefore] = real("forms")
    ? await Promise.all([q.formTotals(db, current, timezone), q.formTotals(db, previous, timezone)])
    : [null, null];
  for (const meta of sample.KPI_META) {
    if (!real(meta.source)) {
      kpis.push(sampleKpis.get(meta.key)!);
      continue;
    }
    let value = 0;
    let before = 0;
    if (meta.source === "forms" && formsNow && formsBefore) {
      const k = meta.key as "leads" | "signups" | "unfinished";
      value = formsNow[k];
      before = formsBefore[k];
    } else if (meta.source === "ga4") {
      [value, before] = await Promise.all([q.ga4Visits(db, current), q.ga4Visits(db, previous)]);
    } else if (meta.source === "gsc") {
      [value, before] = await Promise.all([q.gscClicks(db, current), q.gscClicks(db, previous)]);
    } else if (meta.source === "instantly") {
      [value, before] = await Promise.all([q.instantlyReplies(db, current), q.instantlyReplies(db, previous)]);
    }
    kpis.push({ ...meta, value, previous: before, origin: "real" });
  }

  const formsReal = real("forms");
  const leadsBySource = formsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "leads") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "leads") };
  const signupsBySource = formsReal
    ? { origin: "real" as const, buckets: await q.bySource(db, range, timezone, "signups") }
    : { origin: "sample" as const, buckets: sample.sampleBySource(range, "signups") };

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
        daily: await q.searchDaily(db, current),
        rows: await q.topSearches(db, current),
      }
    : { origin: "sample" as const, daily: sample.sampleSearchDaily(range), rows: sample.sampleSearches(range) };

  const coldEmail = real("instantly")
    ? { origin: "real" as const, rows: await q.campaignRows(db, current, timezone, formsReal) }
    : { origin: "sample" as const, rows: sample.sampleCampaigns(range) };

  return { range, timezone, sources, kpis, leadsBySource, signupsBySource, pages, searches, coldEmail };
}
