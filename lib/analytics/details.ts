/**
 * Queries behind the deeper Analytics sections: plans, lead status, search mix,
 * website traffic and the cold email funnel. Each takes the database handle so
 * tests run them on embedded Postgres.
 */
import type { Db } from "@/lib/db/types";
import { pagePath } from "@/lib/format";
import { normalizePlan } from "@/lib/sources/lead-sheet";
import { PAGE_GROUPS, SEARCH_GROUPS, pageGroup, searchGroup, type PageGroupKey, type SearchGroupKey } from "./groups";
import { EVENTS } from "./queries";
import type { Coverage, EmailStepRow, FunnelStep, GroupRow, LandingRow, Ranked, SearchStats } from "./types";

type Period = { start: string; end: string };

/** The first day each source has data, so comparisons never reach back past it. */
export async function coverage(db: Db, tz: string): Promise<Coverage> {
  const [row] = await db.query<Record<string, string | null>>(
    `select
       (select min(day)::text from spiral.gsc_daily_site) as gsc,
       (select min(day)::text from spiral.ga4_daily_site) as ga4,
       (select min(day)::text from spiral.instantly_campaign_daily) as instantly,
       (select min((received_at at time zone $1)::date)::text from spiral.form_entries) as forms,
       (select min(day)::text from spiral.lead_sheet_rows) as lead_sheet`,
    [tz],
  );
  const out: Coverage = {};
  for (const [k, v] of Object.entries(row ?? {})) if (v) out[k as keyof Coverage] = v;
  const leadDays = [out.forms, out.lead_sheet].filter((d): d is string => Boolean(d)).sort();
  if (leadDays[0]) out.leads = leadDays[0];
  return out;
}

/** The last day each source has data. */
export async function coverageEnd(db: Db): Promise<Coverage> {
  const [row] = await db.query<Record<string, string | null>>(
    `select (select max(day)::text from spiral.gsc_daily_site) as gsc,
            (select max(day)::text from spiral.ga4_daily_site) as ga4,
            (select max(day)::text from spiral.instantly_campaign_daily) as instantly`,
  );
  const out: Coverage = {};
  for (const [k, v] of Object.entries(row ?? {})) if (v) out[k as keyof Coverage] = v;
  return out;
}

/** Search Console's own totals for a period: clicks, impressions, click rate, average position. */
export async function searchTotals(db: Db, p: Period): Promise<SearchStats> {
  const [r] = await db.query<{ clicks: number; impressions: number; position: number | null }>(
    `select coalesce(sum(clicks), 0)::int as clicks, coalesce(sum(impressions), 0)::int as impressions,
            (sum(position * impressions) / nullif(sum(impressions), 0))::float8 as position
       from spiral.gsc_daily_site where day between $1::date and $2::date`,
    [p.start, p.end],
  );
  const clicks = r?.clicks ?? 0;
  const impressions = r?.impressions ?? 0;
  return { clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: r?.position ?? 0 };
}

/** Clicks and impressions per search group (searches Google shows by name only), from every search in the period. */
export function searchGroups(rows: { query: string; clicks: number; impressions: number }[]): GroupRow<SearchGroupKey>[] {
  const out = SEARCH_GROUPS.map((g) => ({ ...g, clicks: 0, impressions: 0, items: 0 }));
  for (const r of rows) {
    const g = out.find((x) => x.key === searchGroup(r.query))!;
    g.clicks += r.clicks;
    g.impressions += r.impressions;
    g.items += 1;
  }
  return out;
}

/** Clicks and impressions per page group (from the per-page totals). */
export async function pageGroups(db: Db, p: Period): Promise<GroupRow<PageGroupKey>[]> {
  const rows = await db.query<{ page: string; clicks: number; impressions: number }>(
    `select page, sum(clicks)::int as clicks, sum(impressions)::int as impressions
       from spiral.gsc_daily_page where day between $1::date and $2::date group by page`,
    [p.start, p.end],
  );
  const out = PAGE_GROUPS.map((g) => ({ ...g, clicks: 0, impressions: 0, items: 0 }));
  const seen = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = pageGroup(r.page);
    const g = out.find((x) => x.key === key)!;
    g.clicks += r.clicks;
    g.impressions += r.impressions;
    // http/https and www are the same page.
    const id = r.page.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(id);
  }
  for (const g of out) g.items = seen.get(g.key)?.size ?? 0;
  return out;
}

const PLAN_LABEL: Record<string, string> = {
  "100%": "100% commission",
  "90%": "90% commission",
  "Park Your License": "Park Your License",
  Referral: "Referral agent",
};

function rankPlans(counts: Map<string, Set<string>>): Ranked[] {
  const known = Object.keys(PLAN_LABEL)
    .map((k) => ({ key: k, label: PLAN_LABEL[k], value: counts.get(k)?.size ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const unstated = counts.get("none")?.size ?? 0;
  return unstated ? [...known, { key: "none", label: "Not stated", value: unstated }] : known;
}

/** Plans agents joined, and plans leads asked about (people counted once per plan). */
export async function plans(db: Db, p: Period, tz: string): Promise<{ joined: Ranked[]; asked: Ranked[] }> {
  const rows = await db.query<{ who: string; signup: boolean; plan: string | null }>(
    `with ev as (${EVENTS}) select who, signup, plan from ev where day between $1::date and $2::date`,
    [p.start, p.end, tz],
  );
  const joined = new Map<string, Set<string>>();
  const asked = new Map<string, Set<string>>();
  for (const r of rows) {
    const plan = normalizePlan(r.plan) ?? "none";
    const target = r.signup ? joined : asked;
    if (!target.has(plan)) target.set(plan, new Set());
    target.get(plan)!.add(r.who);
  }
  return { joined: rankPlans(joined), asked: rankPlans(asked) };
}

/** The lead sheet's Status values, in pipeline order (shared by every section that reads them). */
export const STATUS_ORDER = [
  { key: "signed", label: "Signed up", test: /signed/i },
  { key: "interested", label: "Interested", test: /^(?!.*not).*interested/i },
  { key: "following", label: "Following up", test: /chas|follow/i },
  { key: "not", label: "Not interested", test: /not interested/i },
] as const;

export function rankStatuses(rows: { status: string | null; n: number }[]): Ranked[] {
  const out = STATUS_ORDER.map((o) => ({ key: o.key as string, label: o.label as string, value: 0 }));
  let other = 0;
  for (const r of rows) {
    const i = STATUS_ORDER.findIndex((o) => o.test.test(r.status ?? ""));
    if (i >= 0) out[i].value += r.n;
    else other += r.n;
  }
  return other ? [...out, { key: "other", label: "No status yet", value: other }] : out;
}

/** Google Analytics for a period: totals, channels, devices and landing pages. */
export async function website(db: Db, p: Period) {
  const [totals] = await db.query<{ sessions: number; engaged: number }>(
    `select coalesce(sum(sessions), 0)::int as sessions, coalesce(sum(engaged_sessions), 0)::int as engaged
       from spiral.ga4_daily_site where day between $1::date and $2::date`,
    [p.start, p.end],
  );
  const by = (col: string) =>
    db.query<{ label: string; n: number }>(
      `select ${col} as label, sum(sessions)::int as n from spiral.ga4_daily
        where day between $1::date and $2::date group by 1 order by 2 desc`,
      [p.start, p.end],
    );
  const channels: Ranked[] = (await by("channel_group")).map((r) => ({ key: r.label, label: r.label, value: r.n }));
  const devices: Ranked[] = (await by("device")).map((r) => ({
    key: r.label,
    label: r.label.charAt(0).toUpperCase() + r.label.slice(1),
    value: r.n,
  }));
  const pages = await db.query<{ page: string; sessions: number; engaged: number }>(
    `select landing_page as page, sum(sessions)::int as sessions, sum(engaged_sessions)::int as engaged
       from spiral.ga4_daily where day between $1::date and $2::date group by 1`,
    [p.start, p.end],
  );
  const merged = new Map<string, LandingRow>();
  for (const r of pages) {
    if (r.page === "(not set)") continue;
    const path = pagePath(r.page);
    const row = merged.get(path) ?? { path, group: pageGroup(path), sessions: 0, engaged: 0 };
    row.sessions += r.sessions;
    row.engaged += r.engaged;
    merged.set(path, row);
  }
  const landing = [...merged.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 15);
  return { sessions: totals?.sessions ?? 0, engaged: totals?.engaged ?? 0, channels, devices, landing };
}

/** Instantly's funnel for exactly this period (stored by the sync), or null if it isn't stored. */
export async function coldFunnel(db: Db, p: Period) {
  const [o] = await db.query<{
    sent: number;
    new_contacted: number;
    replied: number;
    interested: number;
    meetings_booked: number;
    meetings_completed: number;
    won: number;
    bounced: number;
    auto_replies: number;
  }>(
    `select sent, new_contacted, replied, interested, meetings_booked, meetings_completed, won, bounced, auto_replies
       from spiral.instantly_range_overview where range_start = $1::date and range_end = $2::date`,
    [p.start, p.end],
  );
  if (!o) return null;
  const funnel: FunnelStep[] = [
    { key: "sent", label: "Emails sent", value: o.sent, note: "Every email in the period, follow-ups included." },
    { key: "replied", label: "Replied", value: o.replied, note: "Different people who replied. Out-of-office replies are left out." },
    { key: "interested", label: "Marked interested", value: o.interested },
  ];
  // Only shown once Spiral NY uses these stages in Instantly.
  if (o.meetings_booked) funnel.push({ key: "meetings", label: "Meeting booked", value: o.meetings_booked });
  if (o.won) funnel.push({ key: "won", label: "Won", value: o.won });
  return { funnel, health: { sent: o.sent, newContacted: o.new_contacted, bounced: o.bounced, autoReplies: o.auto_replies } };
}

/** Each email of the sequences for exactly this period, all campaigns added up. */
export async function emailSteps(db: Db, p: Period): Promise<EmailStepRow[]> {
  return db.query<EmailStepRow>(
    `select step, variant, sent, replies, opportunities from spiral.instantly_range_steps
      where range_start = $1::date and range_end = $2::date order by step, variant`,
    [p.start, p.end],
  );
}
