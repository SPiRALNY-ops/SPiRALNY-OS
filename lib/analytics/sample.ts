/**
 * Sample numbers for the Analytics tab, shown (with a "Sample data" label)
 * until each source is connected. Deterministic: the same date always
 * produces the same numbers, so the page doesn't shuffle on reload.
 * Page paths are real spiralny.com pages; searches and campaign names are
 * illustrative only.
 */
import { bucketKeyFor, eachDay } from "./range";
import type {
  CampaignRow,
  DailySearchPoint,
  DateRange,
  Kpi,
  KpiKey,
  LeadSource,
  PageRow,
  SearchRow,
  SourceBucket,
} from "./types";
import { LEAD_SOURCES } from "./types";

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Stable pseudo-random number in [0, 1) for a given key. */
function rand(key: string): number {
  let t = hash(key) + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function weekdayFactor(day: string): number {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return dow === 0 ? 0.55 : dow === 6 ? 0.7 : 1.05;
}

/** A gently rising trend so the sample tells a believable story. */
function trend(day: string, anchor: string): number {
  const daysAgo = Math.max(0, (new Date(`${anchor}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000);
  return 1 - Math.min(daysAgo, 400) / 1600;
}

function count(day: string, metric: string, base: number, anchor: string): number {
  const noise = 0.65 + 0.7 * rand(`${day}:${metric}`);
  return Math.round(base * weekdayFactor(day) * trend(day, anchor) * noise);
}

const SOURCE_SHARE: Record<LeadSource, number> = { google: 0.46, cold_email: 0.31, referral: 0.09, unknown: 0.14 };

type DayNumbers = Record<KpiKey, number> & { leadsBy: Record<LeadSource, number>; signupsBy: Record<LeadSource, number>; impressions: number };

function dayNumbers(day: string, anchor: string): DayNumbers {
  const leadsBy = {} as Record<LeadSource, number>;
  const signupsBy = {} as Record<LeadSource, number>;
  for (const source of LEAD_SOURCES) {
    leadsBy[source] = count(day, `lead:${source}`, 4.2 * SOURCE_SHARE[source], anchor);
    // Each sample lead signs up with ~20% chance (a bit higher for referrals).
    const rate = source === "referral" ? 0.3 : source === "unknown" ? 0.12 : 0.2;
    signupsBy[source] = 0;
    for (let i = 0; i < leadsBy[source]; i++) {
      if (rand(`${day}:conv:${source}:${i}`) < rate) signupsBy[source] += 1;
    }
  }
  const leads = LEAD_SOURCES.reduce((s, k) => s + leadsBy[k], 0);
  const signups = LEAD_SOURCES.reduce((s, k) => s + signupsBy[k], 0);
  return {
    leads,
    signups,
    unfinished: Math.max(0, Math.round((leads - signups) * (0.45 + 0.25 * rand(`${day}:unfinished`)))),
    visits: count(day, "visits", 165, anchor),
    googleClicks: count(day, "clicks", 41, anchor),
    impressions: count(day, "impressions", 1750, anchor),
    replies: count(day, "replies", 7, anchor),
    leadsBy,
    signupsBy,
  };
}

const KPI_META: { key: KpiKey; label: string; source: Kpi["source"] }[] = [
  { key: "leads", label: "New leads", source: "forms" },
  { key: "signups", label: "Completed sign-ups", source: "forms" },
  { key: "unfinished", label: "Unfinished forms", source: "forms" },
  { key: "visits", label: "Website visits", source: "ga4" },
  { key: "googleClicks", label: "Clicks from Google", source: "gsc" },
  { key: "replies", label: "Cold email replies", source: "instantly" },
];
export { KPI_META };

function sumDays(days: string[], anchor: string, key: KpiKey): number {
  return days.reduce((s, d) => s + dayNumbers(d, anchor)[key], 0);
}

export function sampleKpis(range: DateRange): Kpi[] {
  const current = eachDay(range.start, range.end);
  const previous = eachDay(range.previousStart, range.previousEnd);
  return KPI_META.map((m) => ({
    ...m,
    value: sumDays(current, range.end, m.key),
    previous: sumDays(previous, range.end, m.key),
    origin: "sample",
  }));
}

export function sampleBySource(range: DateRange, which: "leads" | "signups"): SourceBucket[] {
  const buckets = new Map<string, SourceBucket>(
    range.buckets.map((b) => [b.key, { ...b, google: 0, cold_email: 0, referral: 0, unknown: 0 }]),
  );
  for (const day of eachDay(range.start, range.end)) {
    const n = dayNumbers(day, range.end);
    const bucket = buckets.get(bucketKeyFor(day, range));
    if (!bucket) continue;
    for (const source of LEAD_SOURCES) bucket[source] += which === "leads" ? n.leadsBy[source] : n.signupsBy[source];
  }
  return [...buckets.values()];
}

export function sampleSearchDaily(range: DateRange): DailySearchPoint[] {
  return eachDay(range.start, range.end).map((day) => {
    const n = dayNumbers(day, range.end);
    return { day, clicks: n.googleClicks, impressions: n.impressions };
  });
}

/** Real spiralny.com pages, weighted by how much each might contribute. */
const SAMPLE_PAGES: { path: string; weight: number; searches: string[] }[] = [
  { path: "/", weight: 0.2, searches: ["spiral ny real estate", "spiralny", "spiral real estate brokerage"] },
  { path: "/100-commission-brokerage/", weight: 0.16, searches: ["100 commission real estate brokerage ny", "100% commission brokerage new york", "no split brokerage nyc"] },
  { path: "/new-york-no-commission-splits-brokerage/", weight: 0.12, searches: ["no commission split brokerage ny", "real estate brokerage no split new york"] },
  { path: "/new-york-real-estate-referral-agent/", weight: 0.1, searches: ["real estate referral agent ny", "referral only real estate license new york"] },
  { path: "/brooklyn-100-commission-brokerage/", weight: 0.09, searches: ["100 commission brokerage brooklyn", "brooklyn real estate brokerage for agents"] },
  { path: "/manhattan-100-commission-brokerage/", weight: 0.08, searches: ["100 commission brokerage manhattan", "manhattan brokerage no desk fee"] },
  { path: "/park-your-license-and-stay-active-in-brooklyn/", weight: 0.07, searches: ["park real estate license ny", "keep real estate license active ny"] },
  { path: "/join-our-team/", weight: 0.07, searches: ["join real estate brokerage ny", "spiral ny join"] },
  { path: "/buffalo-100-commission-brokerage/", weight: 0.06, searches: ["100 commission brokerage buffalo ny"] },
  { path: "/albany-real-estate-referral-agent/", weight: 0.05, searches: ["referral agent albany ny"] },
];

export function sampleSearches(range: DateRange): SearchRow[] {
  const totalClicks = sumDays(eachDay(range.start, range.end), range.end, "googleClicks");
  const rows: SearchRow[] = [];
  for (const page of SAMPLE_PAGES) {
    page.searches.forEach((query, i) => {
      const share = page.weight * (i === 0 ? 0.55 : 0.45 / Math.max(1, page.searches.length - 1));
      const clicks = Math.round(totalClicks * share * (0.8 + 0.4 * rand(`${range.key}:${query}`)));
      const ctr = 0.018 + 0.05 * rand(`ctr:${query}`);
      rows.push({
        query,
        clicks,
        impressions: Math.round(clicks / ctr),
        position: Math.round((2 + 14 * rand(`pos:${query}`)) * 10) / 10,
      });
    });
  }
  return rows.sort((a, b) => b.clicks - a.clicks);
}

export function samplePages(range: DateRange): PageRow[] {
  const days = eachDay(range.start, range.end);
  const totals = {
    visits: sumDays(days, range.end, "visits"),
    clicks: sumDays(days, range.end, "googleClicks"),
    leads: sumDays(days, range.end, "leads"),
    signups: sumDays(days, range.end, "signups"),
  };
  const searches = sampleSearches(range);
  return SAMPLE_PAGES.map((p) => {
    const jitter = (m: string) => 0.8 + 0.4 * rand(`${range.key}:${p.path}:${m}`);
    const leads = Math.round(totals.leads * p.weight * jitter("leads"));
    return {
      path: p.path,
      visits: Math.round(totals.visits * p.weight * jitter("visits")),
      googleClicks: Math.round(totals.clicks * p.weight * jitter("clicks")),
      leads,
      signups: Math.min(leads, Math.round(totals.signups * p.weight * jitter("signups"))),
      topSearches: searches.filter((s) => p.searches.includes(s.query)),
    };
  }).sort((a, b) => (b.signups ?? 0) - (a.signups ?? 0) || (b.leads ?? 0) - (a.leads ?? 0));
}

const SAMPLE_CAMPAIGNS = [
  { id: "sample-1", name: "NY agents: 100% commission", weight: 0.38 },
  { id: "sample-2", name: "NY agents: referral plan", weight: 0.24 },
  { id: "sample-3", name: "Inactive licenses: park your license", weight: 0.22 },
  { id: "sample-4", name: "Brooklyn & Queens agents", weight: 0.16 },
];

export function sampleCampaigns(range: DateRange): CampaignRow[] {
  const days = eachDay(range.start, range.end);
  const replies = sumDays(days, range.end, "replies");
  const leads = days.reduce((s, d) => s + dayNumbers(d, range.end).leadsBy.cold_email, 0);
  const signups = days.reduce((s, d) => s + dayNumbers(d, range.end).signupsBy.cold_email, 0);
  return SAMPLE_CAMPAIGNS.map((c) => {
    const j = (m: string) => 0.8 + 0.4 * rand(`${range.key}:${c.id}:${m}`);
    const campaignReplies = Math.round(replies * c.weight * j("replies"));
    return {
      id: c.id,
      name: c.name,
      sent: Math.round(days.length * 460 * c.weight * j("sent")),
      replies: campaignReplies,
      interested: Math.round(campaignReplies * (0.22 + 0.15 * rand(`${c.id}:int`))),
      leads: Math.round(leads * c.weight * j("leads")),
      signups: Math.round(signups * c.weight * j("signups")),
    };
  });
}
