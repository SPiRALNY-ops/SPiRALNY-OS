/**
 * The long view: numbers that don't depend on the period picker. Sixteen months of Google search,
 * sign-ups by month and plan, how each month's leads turned out, the follow-up backlog, new-agent
 * onboarding, the state of the lead sheet, and the cold email reply rate by week and month.
 * Built once a day (and after each sync), not once per period.
 */
import type { Db } from "@/lib/db/types";
import { pagePath } from "@/lib/format";
import { normalizePlan } from "@/lib/sources/lead-sheet";
import { rankStatuses } from "./details";
import { pageGroup, searchGroup, type SearchGroupKey } from "./groups";
import { EVENTS, lastSuccessfulSyncs } from "./queries";
import { addDays, makeBuckets, monthStart } from "./range";
import type { LongView, MonthPoint, PlanKey } from "./types";

/** How far back the long trends go: Search Console keeps 16 months. */
export const LONG_MONTHS = 16;
/** Recruiting pages shown in "Recruiting pages over time". */
const RECRUITING_PAGES = 8;
const PLANS: (PlanKey | "none")[] = ["100%", "90%", "Park Your License", "Referral", "none"];

/** Calendar months ending with the one holding `end`, oldest first, marked partial where the data doesn't cover them. */
export function monthPoints(end: string, count: number, dataFrom?: string | null, dataTo?: string | null): (MonthPoint & { start: string; end: string })[] {
  let first = monthStart(end);
  for (let i = 1; i < count; i++) first = monthStart(addDays(first, -1));
  const lastDay = dataTo && dataTo < end ? dataTo : end;
  return makeBuckets(first, end, "month").map((b) => {
    const monthEnd = addDays(monthStart(addDays(`${b.key.slice(0, 7)}-28`, 7)), -1);
    const starts = dataFrom && dataFrom > b.start && dataFrom <= b.end ? dataFrom : undefined;
    return {
      key: b.key.slice(0, 7),
      label: b.label,
      start: b.start,
      end: b.end,
      partial: b.end < monthEnd || lastDay < monthEnd || Boolean(starts),
      ...(starts ? { starts } : {}),
    };
  });
}

const month = (day: string) => day.slice(0, 7);

export async function buildLong(db: Db, today: string, timezone: string): Promise<LongView> {
  const synced = await lastSuccessfulSyncs(db);
  const yesterday = addDays(today, -1);
  const [search, leads, cold] = await Promise.all([
    synced.gsc ? longSearch(db, yesterday) : null,
    synced.forms || synced.lead_sheet ? longLeads(db, yesterday, timezone) : null,
    synced.instantly ? longCold(db, yesterday) : null,
  ]);
  return { today, search, leads, cold };
}

async function longSearch(db: Db, yesterday: string): Promise<LongView["search"]> {
  const [cover] = await db.query<{ first: string | null; last: string | null }>(
    "select min(day)::text as first, max(day)::text as last from spiral.gsc_daily_site",
  );
  const months = monthPoints(yesterday, LONG_MONTHS, cover?.first, cover?.last);
  const from = months[0].start;
  const [site, named, pages] = await Promise.all([
    db.query<{ m: string; clicks: number; impressions: number }>(
      `select to_char(day, 'YYYY-MM') as m, sum(clicks)::int as clicks, sum(impressions)::int as impressions
         from spiral.gsc_daily_site where day >= $1::date group by 1`,
      [from],
    ),
    db.query<{ m: string; query: string; clicks: number }>(
      `select to_char(day, 'YYYY-MM') as m, query, sum(clicks)::int as clicks
         from spiral.gsc_daily where day >= $1::date group by 1, 2 having sum(clicks) > 0`,
      [from],
    ),
    db.query<{ m: string; page: string; clicks: number }>(
      `select to_char(day, 'YYYY-MM') as m, page, sum(clicks)::int as clicks
         from spiral.gsc_daily_page where day >= $1::date group by 1, 2 having sum(clicks) > 0`,
      [from],
    ),
  ]);
  const index = new Map(months.map((m, i) => [m.key, i]));
  const zeros = () => months.map(() => 0);
  const clicks = zeros();
  const impressions = zeros();
  for (const r of site) {
    const i = index.get(r.m);
    if (i === undefined) continue;
    clicks[i] += r.clicks;
    impressions[i] += r.impressions;
  }
  const groups: Record<SearchGroupKey, number[]> = { brand: zeros(), recruiting: zeros(), other: zeros() };
  let namedTotal = 0;
  for (const r of named) {
    const i = index.get(r.m);
    if (i === undefined) continue;
    groups[searchGroup(r.query)][i] += r.clicks;
    namedTotal += r.clicks;
  }
  const byPage = new Map<string, number[]>();
  for (const r of pages) {
    const i = index.get(r.m);
    if (i === undefined || pageGroup(r.page) !== "recruiting") continue;
    const path = pagePath(r.page);
    const row = byPage.get(path) ?? zeros();
    row[i] += r.clicks;
    byPage.set(path, row);
  }
  const recruitingPages = [...byPage.entries()]
    .map(([path, monthly]) => ({ path, monthly, clicks: monthly.reduce((s, n) => s + n, 0) }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, RECRUITING_PAGES);
  const siteTotal = clicks.reduce((s, n) => s + n, 0);
  return {
    months: months.map(({ key, label, partial, starts }) => ({ key, label, partial, starts })),
    clicks,
    impressions,
    groups,
    namedShare: siteTotal ? namedTotal / siteTotal : 0,
    recruitingPages,
  };
}

async function longLeads(db: Db, yesterday: string, timezone: string): Promise<LongView["leads"]> {
  // EVENTS takes the time zone as $3; this query has no other parameters.
  const events = EVENTS.replaceAll("$3", "$1");
  const [people, backlog, onboarding, health, history] = await Promise.all([
    db.query<{ lead_day: string | null; signed_day: string | null; plan: string | null; status_signed: boolean }>(
      `with ev as (${events}),
       per as (
         select who,
                min(day) filter (where not signup) as lead_day,
                min(day) filter (where signup) as signed_day,
                (array_agg(plan order by day) filter (where signup and plan is not null))[1] as plan
           from ev group by who
       ),
       signed_status as (
         select distinct coalesce(r.person_id::text, lower(r.email), r.tab || '#' || r.row_number) as who
           from spiral.lead_sheet_rows r where r.status ~* 'signed'
       )
       select per.lead_day::text as lead_day, per.signed_day::text as signed_day, per.plan,
              (s.who is not null) as status_signed
         from per left join signed_status s on s.who = per.who`,
      [timezone],
    ),
    // Every lead on the sheet, dated or not, as its Status reads today.
    db.query<{ status: string | null; undated: boolean; n: number }>(
      `select status, day is null as undated,
              count(distinct coalesce(person_id::text, lower(email), tab || '#' || row_number))::int as n
         from spiral.lead_sheet_rows where kind = 'lead' group by 1, 2`,
    ),
    // Agents who withdrew their association aren't counted as still to do.
    db.query<{ signed: number; associated: number; whatsapp: number; withdrew: number; not_associated: number; not_whatsapp: number }>(
      `select count(*)::int as signed,
              count(*) filter (where associated)::int as associated,
              count(*) filter (where whatsapp)::int as whatsapp,
              count(*) filter (where withdrew)::int as withdrew,
              count(*) filter (where not coalesce(associated, false) and not coalesce(withdrew, false))::int as not_associated,
              count(*) filter (where not coalesce(whatsapp, false) and not coalesce(withdrew, false))::int as not_whatsapp
         from spiral.lead_sheet_rows where kind = 'signup'`,
    ),
    db.query<{ kind: string; rows: number; no_date: number; no_plan: number; no_source: number }>(
      `select r.kind, count(*)::int as rows,
              count(*) filter (where r.day is null)::int as no_date,
              count(*) filter (where r.plan is null)::int as no_plan,
              count(*) filter (where coalesce(p.source, r.source) not in ('google', 'cold_email', 'referral'))::int as no_source
         from spiral.lead_sheet_rows r left join spiral.people p on p.id = r.person_id
        group by r.kind`,
    ),
    db.query<{ days: number }>("select count(distinct day)::int as days from spiral.lead_status_changes"),
  ]);

  // Sign-ups by month and plan, from the first sign-up on record.
  const signedDays = people.map((p) => p.signed_day).filter((d): d is string => Boolean(d)).sort();
  const firstSignup = signedDays[0] ?? yesterday;
  const signupSpan = Math.min(LONG_MONTHS, monthsBetween(firstSignup, yesterday) + 1);
  const signupMonths = monthPoints(yesterday, signupSpan, firstSignup);
  const sIndex = new Map(signupMonths.map((m, i) => [m.key, i]));
  const total = signupMonths.map(() => 0);
  const plans = Object.fromEntries(PLANS.map((p) => [p, signupMonths.map(() => 0)])) as Record<PlanKey | "none", number[]>;
  for (const p of people) {
    if (!p.signed_day) continue;
    const i = sIndex.get(month(p.signed_day));
    if (i === undefined) continue;
    total[i] += 1;
    plans[(normalizePlan(p.plan) ?? "none") as PlanKey | "none"][i] += 1;
  }

  // How each month's new leads turned out (signed since, on the sheet or a completed form).
  const leadDays = people.map((p) => p.lead_day).filter((d): d is string => Boolean(d)).sort();
  const firstLead = leadDays[0] ?? yesterday;
  const inquirySpan = Math.min(12, monthsBetween(firstLead, yesterday) + 1);
  const inquiryPoints = monthPoints(yesterday, inquirySpan, firstLead);
  const inquiry = inquiryPoints.map((m) => ({ month: { key: m.key, label: m.label, partial: m.partial, starts: m.starts }, leads: 0, signed: 0 }));
  const iIndex = new Map(inquiryPoints.map((m, i) => [m.key, i]));
  for (const p of people) {
    if (p.lead_day) {
      const i = iIndex.get(month(p.lead_day));
      if (i !== undefined) {
        inquiry[i].leads += 1;
        if (p.signed_day || p.status_signed) inquiry[i].signed += 1;
      }
    }
  }

  const leadHealth = health.find((h) => h.kind === "lead");
  const signupHealth = health.find((h) => h.kind === "signup");
  return {
    signupMonths: signupMonths.map(({ key, label, partial, starts }) => ({ key, label, partial, starts })),
    signups: { total, plans },
    inquiryMonths: inquiry,
    backlog: {
      rows: rankStatuses(backlog.map((b) => ({ status: b.status, n: b.n }))),
      undated: backlog.filter((b) => b.undated).reduce((s, b) => s + b.n, 0),
      total: backlog.reduce((s, b) => s + b.n, 0),
    },
    onboarding: {
      signed: onboarding[0]?.signed ?? 0,
      associated: onboarding[0]?.associated ?? 0,
      whatsapp: onboarding[0]?.whatsapp ?? 0,
      withdrew: onboarding[0]?.withdrew ?? 0,
      notAssociated: onboarding[0]?.not_associated ?? 0,
      notWhatsapp: onboarding[0]?.not_whatsapp ?? 0,
    },
    health: {
      leadRows: leadHealth?.rows ?? 0,
      noDate: leadHealth?.no_date ?? 0,
      noPlan: leadHealth?.no_plan ?? 0,
      noSource: leadHealth?.no_source ?? 0,
      signups: signupHealth?.rows ?? 0,
      signupsNoSource: signupHealth?.no_source ?? 0,
    },
    historyDays: history[0]?.days ?? 0,
  };
}

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

/** Weeks shown in the reply-rate trend. */
const COLD_WEEKS = 26;

async function longCold(db: Db, yesterday: string): Promise<LongView["cold"]> {
  const [weeks, months, cover] = await Promise.all([
    db.query<{ k: string; sent: number; replies: number }>(
      `select date_trunc('week', day)::date::text as k, sum(sent)::int as sent, sum(replies)::int as replies
         from spiral.instantly_campaign_daily where day >= $1::date group by 1 order by 1`,
      [addDays(yesterday, -7 * COLD_WEEKS)],
    ),
    db.query<{ k: string; sent: number; replies: number }>(
      `select to_char(day, 'YYYY-MM') as k, sum(sent)::int as sent, sum(replies)::int as replies
         from spiral.instantly_campaign_daily group by 1 order by 1`,
    ),
    db.query<{ first: string | null }>("select min(day)::text as first from spiral.instantly_campaign_daily where sent > 0"),
  ]);
  const first = cover[0]?.first ?? yesterday;
  const span = Math.min(LONG_MONTHS, monthsBetween(first, yesterday) + 1);
  const points = monthPoints(yesterday, span, first);
  const byMonth = new Map(months.map((m) => [m.k, m]));
  const weekEnd = (start: string) => addDays(start, 6);
  return {
    weeks: weeks
      .filter((w) => weekEnd(w.k) >= first)
      .map((w) => ({ key: w.k, label: w.k, sent: w.sent, replies: w.replies, partial: weekEnd(w.k) > yesterday || w.k < first })),
    months: points.map((m) => ({ key: m.key, label: m.label, sent: byMonth.get(m.key)?.sent ?? 0, replies: byMonth.get(m.key)?.replies ?? 0, partial: m.partial, starts: m.starts })),
  };
}
