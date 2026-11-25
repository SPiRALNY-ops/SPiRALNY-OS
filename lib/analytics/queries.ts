/**
 * Real-data queries for the Analytics tab. Each takes the database handle so
 * tests can run them on embedded Postgres. All counts are cast to int and
 * dates to text so both drivers return the same shapes.
 */
import type { Db } from "@/lib/db/types";
import { pagePath } from "@/lib/format";
import { pageGroup, searchGroup } from "./groups";
import { bucketKeyFor, eachDay } from "./range";
import type {
  CampaignRow,
  DailySearchPoint,
  DateRange,
  LeadSource,
  PageRow,
  SearchRow,
  SourceBucket,
  SourceKey,
} from "./types";

type Period = { start: string; end: string };

/** Someone who filled a form: their person record, else their email, else the email message. */
const WHO = "coalesce(fe.person_id::text, lower(fe.email), fe.gmail_message_id)";
const IN_PERIOD = "(fe.received_at at time zone $3)::date between $1::date and $2::date";

/** Sources whose latest run found nothing to show yet ("skipped"). */
export async function skippedSources(db: Db): Promise<Set<SourceKey>> {
  const rows = await db.query<{ source: SourceKey; status: string }>(
    "select distinct on (source) source, status from spiral.sync_runs where status <> 'running' order by source, started_at desc",
  );
  return new Set(rows.filter((r) => r.status === "skipped").map((r) => r.source));
}

export async function lastSuccessfulSyncs(db: Db): Promise<Partial<Record<SourceKey, string>>> {
  const rows = await db.query<{ source: string; last: Date | string }>(
    "select source, max(finished_at) as last from spiral.sync_runs where status = 'success' group by source",
  );
  const out: Partial<Record<SourceKey, string>> = {};
  for (const r of rows) out[r.source as SourceKey] = new Date(r.last).toISOString();
  return out;
}

/**
 * Every lead and sign-up: form entries plus lead sheet rows, each tied to its
 * person where one is known, so someone in both counts once. Uses $3 = time zone.
 */
export const EVENTS = `
  select coalesce(fe.person_id::text, lower(fe.email), fe.gmail_message_id) as who,
         (fe.received_at at time zone $3)::date as day,
         fe.entry_type = 'complete' as signup,
         coalesce(p.source, 'unknown') as source,
         lower(fe.email) as email,
         fe.plan as plan
    from spiral.form_entries fe
    left join spiral.people p on p.id = fe.person_id
  union all
  select coalesce(r.person_id::text, lower(r.email), r.tab || '#' || r.row_number),
         r.day,
         r.kind = 'signup',
         coalesce(p.source, r.source),
         lower(r.email),
         r.plan
    from spiral.lead_sheet_rows r
    left join spiral.people p on p.id = r.person_id
   where r.day is not null`;

/** People who became leads / signed up in the period (forms and lead sheet together). */
export async function leadTotals(db: Db, p: Period, tz: string) {
  const [row] = await db.query<{ leads: number; signups: number }>(
    `with ev as (${EVENTS})
     select count(distinct who)::int as leads,
            count(distinct who) filter (where signup)::int as signups
       from ev where day between $1::date and $2::date`,
    [p.start, p.end, tz],
  );
  return { leads: row?.leads ?? 0, signups: row?.signups ?? 0 };
}

/** Form-only numbers (unfinished forms only exist for forms). */
export async function formTotals(db: Db, p: Period, tz: string) {
  const [row] = await db.query<{ leads: number; signups: number }>(
    `select count(distinct ${WHO})::int as leads,
            count(distinct ${WHO}) filter (where fe.entry_type = 'complete')::int as signups
       from spiral.form_entries fe
      where ${IN_PERIOD}`,
    [p.start, p.end, tz],
  );
  const leads = row?.leads ?? 0;
  const signups = row?.signups ?? 0;
  return { leads, signups, unfinished: leads - signups };
}

export async function ga4Visits(db: Db, p: Period): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    "select coalesce(sum(sessions), 0)::int as n from spiral.ga4_daily_site where day between $1::date and $2::date",
    [p.start, p.end],
  );
  return row?.n ?? 0;
}

export async function gscClicks(db: Db, p: Period): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    "select coalesce(sum(clicks), 0)::int as n from spiral.gsc_daily_site where day between $1::date and $2::date",
    [p.start, p.end],
  );
  return row?.n ?? 0;
}

/** Whether the last sync stored Instantly's own totals for exactly this period. */
async function hasInstantlyTotals(db: Db, p: Period): Promise<boolean> {
  const [row] = await db.query<{ any: boolean }>(
    "select exists (select 1 from spiral.instantly_range_totals where range_start = $1::date and range_end = $2::date) as any",
    [p.start, p.end],
  );
  return Boolean(row?.any);
}

/** People who replied, as Instantly counts them; falls back to adding up days for other periods. */
export async function instantlyReplies(db: Db, p: Period): Promise<number> {
  const fromTotals = await hasInstantlyTotals(db, p);
  const [row] = await db.query<{ n: number }>(
    fromTotals
      ? "select coalesce(sum(replies), 0)::int as n from spiral.instantly_range_totals where range_start = $1::date and range_end = $2::date"
      : "select coalesce(sum(replies), 0)::int as n from spiral.instantly_campaign_daily where day between $1::date and $2::date",
    [p.start, p.end],
  );
  return row?.n ?? 0;
}

/** People with no completed form in the period, by the day of their first entry (sums to formTotals().unfinished). */
export async function unfinishedDaily(db: Db, p: Period, tz: string): Promise<[string, number][]> {
  const rows = await db.query<{ day: string; n: number }>(
    `with people as (
       select ${WHO} as who,
              min((fe.received_at at time zone $3)::date) as day,
              bool_or(fe.entry_type = 'complete') as completed
         from spiral.form_entries fe
        where ${IN_PERIOD}
        group by 1
     )
     select day::text as day, count(*)::int as n from people where not completed group by day`,
    [p.start, p.end, tz],
  );
  return rows.map((r) => [r.day, r.n]);
}

/** Daily totals for a tile's trend line. */
export async function ga4VisitsDaily(db: Db, p: Period): Promise<[string, number][]> {
  const rows = await db.query<{ day: string; n: number }>(
    `select day::text as day, sessions as n from spiral.ga4_daily_site
      where day between $1::date and $2::date`,
    [p.start, p.end],
  );
  return rows.map((r) => [r.day, r.n]);
}

export async function instantlyRepliesDaily(db: Db, p: Period): Promise<[string, number][]> {
  const rows = await db.query<{ day: string; n: number }>(
    `select day::text as day, sum(replies)::int as n from spiral.instantly_campaign_daily
      where day between $1::date and $2::date group by day`,
    [p.start, p.end],
  );
  return rows.map((r) => [r.day, r.n]);
}

function toLeadSource(value: string | null): LeadSource {
  return value === "google" || value === "cold_email" || value === "referral" ? value : "unknown";
}

/** People counted once, in the bucket of their first entry in the range, by their source. */
export async function bySource(
  db: Db,
  range: DateRange,
  tz: string,
  which: "leads" | "signups",
): Promise<SourceBucket[]> {
  const rows = await db.query<{ day: string; source: string | null; n: number }>(
    `with ev as (${EVENTS}),
     firsts as (
       select who, min(day) as day, max(source) as source
         from ev
        where day between $1::date and $2::date and (not $4::boolean or signup)
        group by who
     )
     select day::text as day, source, count(*)::int as n from firsts group by day, source`,
    [range.start, range.end, tz, which === "signups"],
  );
  const buckets = new Map<string, SourceBucket>(
    range.buckets.map((b) => [b.key, { ...b, google: 0, cold_email: 0, referral: 0, unknown: 0 }]),
  );
  for (const r of rows) {
    const bucket = buckets.get(bucketKeyFor(r.day, range));
    if (bucket) bucket[toLeadSource(r.source)] += r.n;
  }
  return [...buckets.values()];
}

export async function searchDaily(db: Db, p: Period): Promise<DailySearchPoint[]> {
  const [rows, [last]] = await Promise.all([
    db.query<{ day: string; clicks: number; impressions: number }>(
      `select day::text as day, clicks, impressions
         from spiral.gsc_daily_site where day between $1::date and $2::date
        order by day`,
      [p.start, p.end],
    ),
    db.query<{ d: string | null }>("select max(day)::text as d from spiral.gsc_daily_site"),
  ]);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  // Days Search Console hasn't reported yet are left off, not drawn as zero.
  const end = last?.d && last.d < p.end ? last.d : p.end;
  return eachDay(p.start, end).map((day) => byDay.get(day) ?? { day, clicks: 0, impressions: 0 });
}

const SEARCH_COLUMNS = `sum(clicks)::int as clicks, sum(impressions)::int as impressions,
  coalesce(sum(position * impressions) / nullif(sum(impressions), 0), 0)::float8 as position`;

export type QueryTotal = Omit<SearchRow, "group">;

/**
 * Every search in the period with its totals, most clicked first. Read once and
 * shared by the searches table and the search groups (both need the full list).
 */
export async function searchQueryTotals(db: Db, p: Period): Promise<QueryTotal[]> {
  return db.query<QueryTotal>(
    `select query, ${SEARCH_COLUMNS}
       from spiral.gsc_daily where day between $1::date and $2::date
      group by query order by clicks desc, impressions desc, query`,
    [p.start, p.end],
  );
}

/** The top searches of each group (by clicks, then times shown), so quiet groups still show their searches. */
export function topSearches(rows: QueryTotal[], perGroup = 40): SearchRow[] {
  const taken = new Map<string, number>();
  const out: SearchRow[] = [];
  for (const r of rows) {
    const group = searchGroup(r.query);
    const n = taken.get(group) ?? 0;
    if (n >= perGroup) continue;
    taken.set(group, n + 1);
    out.push({ ...r, group });
  }
  return out;
}

export async function pageRows(
  db: Db,
  p: Period,
  tz: string,
  opts: { withVisits: boolean; withForms: boolean },
): Promise<PageRow[]> {
  const rows = new Map<string, PageRow>();
  const row = (raw: string) => {
    const path = pagePath(raw);
    let r = rows.get(path);
    if (!r) {
      r = {
        path,
        group: pageGroup(raw),
        visits: opts.withVisits ? 0 : null,
        googleClicks: 0,
        leads: opts.withForms ? 0 : null,
        signups: opts.withForms ? 0 : null,
        topSearches: [],
      };
      rows.set(path, r);
    }
    return r;
  };

  // The four reads run together; their results are applied in this order below.
  const [clicks, visits, forms, searches] = await Promise.all([
    db.query<{ page: string; clicks: number }>(
      `select page, sum(clicks)::int as clicks from spiral.gsc_daily_page
        where day between $1::date and $2::date group by page order by clicks desc limit 50`,
      [p.start, p.end],
    ),
    opts.withVisits
      ? db.query<{ page: string; visits: number }>(
          `select landing_page as page, sum(sessions)::int as visits from spiral.ga4_daily
            where day between $1::date and $2::date group by landing_page`,
          [p.start, p.end],
        )
      : [],
    opts.withForms
      ? db.query<{ page: string; leads: number; signups: number }>(
          `select fe.page_url as page, count(distinct ${WHO})::int as leads,
                  count(distinct ${WHO}) filter (where fe.entry_type = 'complete')::int as signups
             from spiral.form_entries fe
            where ${IN_PERIOD} and fe.page_url is not null
            group by fe.page_url`,
          [p.start, p.end, tz],
        )
      : [],
    // Only each page's top five searches leave the database (a page's address can have a few
    // spellings, so the five are picked again below once they're merged by path).
    db.query<Omit<SearchRow, "group"> & { page: string }>(
      `select page, query, clicks, impressions, position from (
         select page, query, ${SEARCH_COLUMNS},
                row_number() over (partition by page order by sum(clicks) desc, sum(impressions) desc, query) as rank
           from spiral.gsc_daily where day between $1::date and $2::date
          group by page, query
       ) ranked where rank <= 5`,
      [p.start, p.end],
    ),
  ]);

  for (const c of clicks) row(c.page).googleClicks += c.clicks;
  for (const v of visits) {
    const r = rows.get(pagePath(v.page));
    if (r && r.visits !== null) r.visits += v.visits;
  }
  for (const f of forms) {
    const r = row(f.page);
    r.leads = (r.leads ?? 0) + f.leads;
    r.signups = (r.signups ?? 0) + f.signups;
  }
  for (const s of searches) {
    const r = rows.get(pagePath(s.page));
    if (r) r.topSearches.push({ query: s.query, clicks: s.clicks, impressions: s.impressions, position: s.position, group: searchGroup(s.query) });
  }
  for (const r of rows.values()) {
    r.topSearches = r.topSearches.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions || (a.query < b.query ? -1 : 1)).slice(0, 5);
  }

  return [...rows.values()]
    .sort(
      (a, b) =>
        (b.signups ?? 0) - (a.signups ?? 0) || (b.leads ?? 0) - (a.leads ?? 0) || b.googleClicks - a.googleClicks,
    )
    .slice(0, 60);
}

export async function campaignRows(db: Db, p: Period, tz: string, withLeads: boolean): Promise<CampaignRow[]> {
  // Instantly's own totals when the last sync stored them for this period (they match its screens);
  // otherwise daily numbers added up.
  const source = (await hasInstantlyTotals(db, p))
    ? "(select campaign_id, sent, contacted, replies, interested, bounced from spiral.instantly_range_totals where range_start = $1::date and range_end = $2::date)"
    : "(select campaign_id, sent, contacted, replies, interested, 0 as bounced from spiral.instantly_campaign_daily where day between $1::date and $2::date)";
  const campaigns = await db.query<Omit<CampaignRow, "leads" | "signups">>(
    `select c.id, c.name,
            coalesce(sum(d.sent), 0)::int as sent,
            coalesce(sum(d.contacted), 0)::int as contacted,
            coalesce(sum(d.replies), 0)::int as replies,
            coalesce(sum(d.interested), 0)::int as interested,
            coalesce(sum(d.bounced), 0)::int as bounced
       from spiral.instantly_campaigns c
       left join ${source} d on d.campaign_id = c.id
      group by c.id, c.name
     having coalesce(sum(d.sent), 0) > 0 or coalesce(sum(d.replies), 0) > 0
      order by sent desc`,
    [p.start, p.end],
  );
  const matched = new Map<string, { leads: number; signups: number }>();
  if (withLeads) {
    const rows = await db.query<{ campaign_id: string; leads: number; signups: number }>(
      // Only people whose source is cold email (the funnel's rule), so a lead who came another way and
      // was added to a campaign afterwards doesn't count as that campaign's lead.
      `with ev as (${EVENTS})
       select il.campaign_id, count(distinct ev.who)::int as leads,
              count(distinct ev.who) filter (where ev.signup)::int as signups
         from ev
         join spiral.instantly_leads il on lower(il.email) = ev.email
        where ev.day between $1::date and $2::date and ev.source = 'cold_email'
        group by il.campaign_id`,
      [p.start, p.end, tz],
    );
    for (const r of rows) matched.set(r.campaign_id, r);
  }
  return campaigns.map((c) => ({
    ...c,
    leads: withLeads ? (matched.get(c.id)?.leads ?? 0) : null,
    signups: withLeads ? (matched.get(c.id)?.signups ?? 0) : null,
  }));
}
