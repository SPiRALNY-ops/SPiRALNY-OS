/** View-model for the Analytics tab. Real queries and the sample generator both produce this shape. */

export type RangeKey = "7d" | "28d" | "90d" | "12m";
export type BucketSize = "day" | "week" | "month";

/** "real" = Spiral NY's synced data. "sample" = made-up numbers shown until the source connects. */
export type Origin = "real" | "sample";

export type SourceKey = "forms" | "ga4" | "gsc" | "instantly";

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
  previous: number;
  origin: Origin;
  source: SourceKey;
};

/** Lead sources the plan asks for, plus "unknown" until a lead's source can be told. */
export type LeadSource = "google" | "cold_email" | "referral" | "unknown";
export const LEAD_SOURCES: LeadSource[] = ["google", "cold_email", "referral", "unknown"];

export type SourceBucket = Bucket & Record<LeadSource, number>;

export type SearchRow = { query: string; clicks: number; impressions: number; position: number };

export type PageRow = {
  path: string;
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
  replies: number;
  interested: number;
  leads: number | null;
  signups: number | null;
};

export type Section<T> = { origin: Origin } & T;

export type AnalyticsView = {
  range: DateRange;
  timezone: string;
  sources: SourceStatus[];
  kpis: Kpi[];
  leadsBySource: Section<{ buckets: SourceBucket[] }>;
  signupsBySource: Section<{ buckets: SourceBucket[] }>;
  pages: Section<{ rows: PageRow[] }>;
  searches: Section<{ daily: DailySearchPoint[]; rows: SearchRow[] }>;
  coldEmail: Section<{ rows: CampaignRow[] }>;
};
