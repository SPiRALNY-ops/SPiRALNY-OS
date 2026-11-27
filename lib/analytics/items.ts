/**
 * What the detail panel shows for one page or one search: sixteen months of Google numbers by
 * month, and what's behind them (the searches that lead to a page, the pages that answer a
 * search). The window is fixed, so the panel doesn't change with the period picker.
 */
import type { Db } from "@/lib/db/types";
import { pagePath } from "@/lib/format";
import { pageGroup, searchGroup } from "./groups";
import { LONG_MONTHS, monthPoints } from "./long";
import { lastSuccessfulSyncs } from "./queries";
import { addDays } from "./range";
import type { ItemView, SearchRow } from "./types";

/** The searches and pages listed in a panel cover the last 90 days. */
export const PANEL_DAYS = 90;

/** A Search Console page address, as the path the dashboard shows ("/x/"), in SQL. */
const PATH_SQL = `regexp_replace(regexp_replace(regexp_replace(page, '^https?://[^/]+', ''), '[?#].*$', ''), '([^/])$', '\\1/')`;
const weighted = `coalesce(sum(position * impressions) / nullif(sum(impressions), 0), 0)::float8 as position`;

export type ItemKind = ItemView["kind"];

export async function buildItem(db: Db, kind: ItemKind, id: string, today: string): Promise<ItemView | null> {
  const synced = await lastSuccessfulSyncs(db);
  if (!synced.gsc) return null;
  const yesterday = addDays(today, -1);
  const [cover] = await db.query<{ first: string | null; last: string | null }>(
    "select min(day)::text as first, max(day)::text as last from spiral.gsc_daily_site",
  );
  const months = monthPoints(yesterday, LONG_MONTHS, cover?.first, cover?.last);
  const from = months[0].start;
  const recent = addDays(yesterday, -(PANEL_DAYS - 1));
  const shape = (rows: { m: string; clicks: number; impressions: number; position: number }[]) => {
    const byMonth = new Map(rows.map((r) => [r.m, r]));
    return months.map((m) => {
      const r = byMonth.get(m.key);
      return { key: m.key, label: m.label, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0, position: r?.position ?? 0 };
    });
  };

  if (kind === "page") {
    const path = pagePath(id);
    const [monthly, searches, visits, forms, urls] = await Promise.all([
      db.query<{ m: string; clicks: number; impressions: number; position: number }>(
        `select to_char(day, 'YYYY-MM') as m, sum(clicks)::int as clicks, sum(impressions)::int as impressions, ${weighted}
           from spiral.gsc_daily_page where day >= $1::date and ${PATH_SQL} = $2 group by 1`,
        [from, path],
      ),
      db.query<Omit<SearchRow, "group">>(
        `select query, sum(clicks)::int as clicks, sum(impressions)::int as impressions, ${weighted}
           from spiral.gsc_daily where day >= $1::date and ${PATH_SQL} = $2
          group by query order by sum(clicks) desc, sum(impressions) desc, query limit 15`,
        [recent, path],
      ),
      synced.ga4
        ? db.query<{ n: number }>(
            `select coalesce(sum(sessions), 0)::int as n from spiral.ga4_daily
              where ${PATH_SQL.replaceAll("page", "landing_page")} = $1 and day >= $2::date`,
            [path, recent],
          )
        : Promise.resolve(null),
      synced.forms
        ? db.query<{ leads: number; signups: number }>(
            `select count(distinct coalesce(person_id::text, lower(email), gmail_message_id))::int as leads,
                    count(distinct coalesce(person_id::text, lower(email), gmail_message_id)) filter (where entry_type = 'complete')::int as signups
               from spiral.form_entries where ${PATH_SQL.replaceAll("page", "page_url")} = $1 and received_at >= $2::date`,
            [path, recent],
          )
        : Promise.resolve(null),
      db.query<{ page: string }>(
        `select page from spiral.gsc_daily_page where ${PATH_SQL} = $1 group by page order by sum(impressions) desc limit 1`,
        [path],
      ),
    ]);
    if (!monthly.length && !searches.length) return null;
    return {
      kind: "page",
      id: path,
      group: pageGroup(urls[0]?.page ?? path),
      url: urls[0]?.page ?? `https://spiralny.com${path}`,
      months: shape(monthly),
      searches: searches.map((s) => ({ ...s, group: searchGroup(s.query) })),
      visits: visits ? (visits[0]?.n ?? 0) : null,
      forms: forms ? (forms[0] ?? { leads: 0, signups: 0 }) : null,
    };
  }

  const [monthly, pages] = await Promise.all([
    db.query<{ m: string; clicks: number; impressions: number; position: number }>(
      `select to_char(day, 'YYYY-MM') as m, sum(clicks)::int as clicks, sum(impressions)::int as impressions, ${weighted}
         from spiral.gsc_daily where query = $1 and day >= $2::date group by 1`,
      [id, from],
    ),
    db.query<{ path: string; clicks: number; impressions: number; position: number }>(
      `select ${PATH_SQL} as path, sum(clicks)::int as clicks, sum(impressions)::int as impressions, ${weighted}
         from spiral.gsc_daily where query = $1 and day >= $2::date
        group by 1 order by sum(impressions) desc limit 10`,
      [id, recent],
    ),
  ]);
  if (!monthly.length) return null;
  return { kind: "search", id, group: searchGroup(id), months: shape(monthly), pages };
}
