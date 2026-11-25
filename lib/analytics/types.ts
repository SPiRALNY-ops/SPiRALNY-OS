/** View-model for the Analytics tab. Real queries and the sample generator both produce this shape. */
import type { PageGroupKey, SearchGroupKey } from "./groups";

export type RangeKey = "7d" | "28d" | "90d" | "12m";
export type BucketSize = "day" | "week" | "month";

/** "real" = Spiral NY's synced data. "sample" = made-up numbers shown until the source connects. */
export type Origin = "real" | "sample";

export type SourceKey = "forms" | "lead_sheet" | "ga4" | "gsc" | "instantly";

export type Bucket = { key: string; start: string; end: string; label: string };

export type DateRange = {
  key: RangeKey;
  label: string;
  start: string; // YYYY-MM-DD, New York date, inclusive
  end: string;
  previousStart: string;
  previousEnd: string;
  bucketSize: BucketSize;
  buckets: Bucket[];
};

export type SourceStatus = {
  key: SourceKey;
  label: string;
  origin: Origin;
  lastSuccessAt: string | null; // ISO timestamp
  waitingFor: string; // what has to happen before this source is real
};

export type KpiKey = "leads" | "signups" | "unfinished" | "visits" | "googleClicks" | "replies";

export type Kpi = {
  key: KpiKey;
  label: string;
  value: number;
  /** null = the source has no data that far back, so there is nothing fair to compare with. */
  previous: number | null;
  /** The first day the source has data, when that falls inside the period (the value only counts from then). */
  since?: string;
  /** One value per bucket of the range (the tile's small trend line). null = no data recorded for that stretch yet. */
  trend: (number | null)[];
  origin: Origin;
  source: SourceKey;
};

/** Lead sources the plan asks for, plus "unknown" until a lead's source can be told. */
export type LeadSource = "google" | "cold_email" | "referral" | "unknown";
export const LEAD_SOURCES: LeadSource[] = ["google", "cold_email", "referral", "unknown"];

export type SourceBucket = Bucket & Record<LeadSource, number>;

export type SearchRow = { query: string; clicks: number; impressions: number; position: number; group: SearchGroupKey };

export type PageRow = {
  path: string;
  group: PageGroupKey;
  visits: number | null; // null = Google Analytics not connected
  googleClicks: number;
  leads: number | null; // null = form emails not connected
  signups: number | null;
  topSearches: SearchRow[];
};

export type DailySearchPoint = { day: string; clicks: number; impressions: number };

export type CampaignRow = {
  id: string;
  name: string;
  sent: number;
  contacted: number;
  replies: number;
  interested: number;
  bounced: number;
  leads: number | null;
  signups: number | null;
};

export type Section<T> = { origin: Origin } & T;

/** One bar of a ranked or ordered list. */
export type Ranked = { key: string; label: string; value: number };

export type SearchStats = { clicks: number; impressions: number; ctr: number; position: number };

export type GroupRow<K extends string> = { key: K; label: string; rule: string; clicks: number; impressions: number; items: number };

export type LandingRow = { path: string; group: PageGroupKey; sessions: number; engaged: number };

export type FunnelStep = { key: string; label: string; value: number; note?: string };

export type EmailStepRow = { step: number; variant: number; sent: number; replies: number; opportunities: number };

/** First day each source has data (YYYY-MM-DD); "leads" covers the forms and the lead sheet together. */
export type Coverage = Partial<Record<SourceKey | "leads", string>>;

export type AnalyticsView = {
  range: DateRange;
  timezone: string;
  sources: SourceStatus[];
  kpis: Kpi[];
  leadsBySource: Section<{ buckets: SourceBucket[] }>;
  signupsBySource: Section<{ buckets: SourceBucket[] }>;
  plans: Section<{ joined: Ranked[]; asked: Ranked[] }>;
  leadStatus: Section<{ rows: Ranked[] }>;
  pages: Section<{ rows: PageRow[]; groups: GroupRow<PageGroupKey>[] }>;
  searches: Section<{
    daily: DailySearchPoint[];
    rows: SearchRow[];
    totals: SearchStats;
    previous: SearchStats | null;
    groups: GroupRow<SearchGroupKey>[];
  }>;
  website: Section<{
    sessions: number;
    engaged: number;
    channels: Ranked[];
    devices: Ranked[];
    landing: LandingRow[];
  }>;
  coldEmail: Section<{
    rows: CampaignRow[];
    funnel: FunnelStep[];
    health: { sent: number; newContacted: number; bounced: number; unsubscribed: number } | null;
    steps: EmailStepRow[];
  }>;
  coverage: Coverage;
  /** Last day each source has data (Search Console runs 2–3 days behind). */
  coverageEnd: Coverage;
};
