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
/** "signups" is separate: the SIGNED! tab starts later than the lead tabs, so sign-ups are on record from later. */
export type Coverage = Partial<Record<SourceKey | "leads" | "signups", string>>;

export type AnalyticsView = {
  range: DateRange;
  timezone: string;
  sources: SourceStatus[];
  kpis: Kpi[];
  leadsBySource: Section<{ buckets: SourceBucket[] }>;
  signupsBySource: Section<{ buckets: SourceBucket[] }>;
  plans: Section<{ joined: Ranked[]; asked: Ranked[] }>;
  pages: Section<{ rows: PageRow[]; groups: GroupRow<PageGroupKey>[] }>;
  searches: Section<{
    daily: DailySearchPoint[];
    rows: SearchRow[];
    totals: SearchStats;
    previous: SearchStats | null;
    groups: GroupRow<SearchGroupKey>[];
    /** Deeper search numbers for the period; null until Search Console is connected. */
    deep: SearchDeep | null;
  }>;
  website: Section<{
    sessions: number;
    engaged: number;
    channels: Ranked[];
    devices: Ranked[];
    landing: LandingRow[];
    /** Where visits came from, by site (Google, ChatGPT, Instagram…); empty for sample data. */
    sources: SourceDetailRow[];
  }>;
  coldEmail: Section<{
    rows: CampaignRow[];
    funnel: FunnelStep[];
    health: { sent: number; newContacted: number; bounced: number; autoReplies: number } | null;
    steps: EmailStepRow[];
  }>;
  coverage: Coverage;
  /** Last day each source has data (Search Console runs 2–3 days behind). */
  coverageEnd: Coverage;
};

/** A recruiting search where spiralny.com sits just off the top of Google (positions 4–20). */
export type OpportunityRow = { query: string; path: string; impressions: number; clicks: number; position: number };

/** A page or search whose clicks moved between this period and the one before. */
export type MoverRow = { key: string; label: string; group: string; now: number; before: number };

/** A search where two or more Spiral NY pages show up, splitting Google's attention. */
export type CompetingRow = {
  query: string;
  group: SearchGroupKey;
  impressions: number;
  pages: { path: string; position: number; impressions: number }[];
};

export type PositionBucket = { key: string; label: string; clicks: number; impressions: number };

export type SearchDeep = {
  /** Clicks on searches Google names (it hides rare ones), for the "covers N%" notes. */
  namedClicks: number;
  opportunities: { rows: OpportunityRow[]; total: number; impressions: number; clicks: number };
  /** null when Search Console doesn't cover the whole period before. */
  movers: { pages: MoverRow[]; searches: MoverRow[] } | null;
  competing: { rows: CompetingRow[]; total: number; recruiting: number };
  positions: PositionBucket[];
};

export type SourceDetailRow = { key: string; label: string; kind: string; sessions: number; engaged: number };

/** A calendar month in New York time. `partial` = the month isn't over (or data stops inside it). */
export type MonthPoint = { key: string; label: string; partial: boolean; /** The data's first day, when it falls inside this month. */ starts?: string };

export type PlanKey = "100%" | "90%" | "Park Your License" | "Referral";

export type RecruitingTrend = { path: string; clicks: number; monthly: number[] };

/** Numbers that don't depend on the period picker: long trends and how things stand today. */
export type LongView = {
  today: string;
  search: {
    months: MonthPoint[];
    clicks: number[];
    impressions: number[];
    /** Clicks on named searches per month, by group. */
    groups: Record<SearchGroupKey, number[]>;
    namedShare: number;
    recruitingPages: RecruitingTrend[];
  } | null;
  leads: {
    signupMonths: MonthPoint[];
    signups: { total: number[]; plans: Record<PlanKey | "none", number[]> };
    inquiryMonths: { month: MonthPoint; leads: number; signed: number }[];
    backlog: { rows: Ranked[]; undated: number; total: number };
    onboarding: { signed: number; associated: number; whatsapp: number; withdrew: number; notAssociated: number; notWhatsapp: number };
    health: { leadRows: number; noDate: number; noPlan: number; noSource: number; signups: number; signupsNoSource: number };
    historyDays: number;
  } | null;
  cold: {
    weeks: { key: string; label: string; sent: number; replies: number; partial: boolean }[];
    months: { key: string; label: string; sent: number; replies: number; partial: boolean; starts?: string }[];
  } | null;
};

/** What the detail panel shows for one page or search. */
export type ItemView =
  | {
      kind: "page";
      id: string;
      group: PageGroupKey;
      url: string;
      months: { key: string; label: string; clicks: number; impressions: number; position: number }[];
      searches: SearchRow[];
      visits: number | null;
      forms: { leads: number; signups: number } | null;
    }
  | {
      kind: "search";
      id: string;
      group: SearchGroupKey;
      months: { key: string; label: string; clicks: number; impressions: number; position: number }[];
      pages: { path: string; clicks: number; impressions: number; position: number }[];
    };
