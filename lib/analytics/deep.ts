/**
 * Deeper numbers for a chosen period: where Spiral NY is close to page one of Google, which pages
 * and searches moved, where its own pages compete, how clicks fall off by position, and where
 * website visits came from in detail. All from data the sync already stores.
 */
import type { Db } from "@/lib/db/types";
import { pagePath } from "@/lib/format";
import { pageGroup, searchGroup } from "./groups";
import type { CompetingRow, MoverRow, OpportunityRow, PositionBucket, SearchDeep, SourceDetailRow } from "./types";

type Period = { start: string; end: string };

/** "Almost on page one": positions 4–20 (just below the top three, or on page two). */
export const OPPORTUNITY_POSITIONS = { from: 4, to: 20 } as const;
/** A search needs this many times shown in the period to count as an opportunity. */
export const OPPORTUNITY_MIN_SHOWN = 10;
/** A page needs this many times shown for a search to count as "competing" for it. */
export const COMPETING_MIN_SHOWN = 10;
/**
 * Pages within this many positions of each other are one result: Google shows sitelinks (extra
 * links under one result) at the same position as the result itself. Only pages at clearly
 * different positions are separate results competing for the search.
 */
const SAME_RESULT = 0.5;
/** A mover needs at least this many clicks in one of the two periods. */
export const MOVER_MIN_CLICKS = 3;

const weighted = `coalesce(sum(position * impressions) / nullif(sum(impressions), 0), 0)::float8 as position`;

export async function searchDeep(db: Db, current: Period, previous: Period | null): Promise<SearchDeep> {
  const [pairs, buckets, pagesNow, pagesBefore, queriesBefore] = await Promise.all([
    db.query<{ query: string; page: string; clicks: number; impressions: number; position: number }>(
      `select query, page, sum(clicks)::int as clicks, sum(impressions)::int as impressions, ${weighted}
         from spiral.gsc_daily where day between $1::date and $2::date group by query, page`,
      [current.start, current.end],
    ),
    // Click rate by position: each day's position for each search and page, as Google reported it.
    db.query<{ bucket: string; clicks: number; impressions: number }>(
      `select case when position < 3.5 then 'top3' when position < 10.5 then 'page1' when position < 20.5 then 'page2' else 'deeper' end as bucket,
              sum(clicks)::int as clicks, sum(impressions)::int as impressions
         from spiral.gsc_daily where day between $1::date and $2::date and position > 0 group by 1`,
      [current.start, current.end],
    ),
    previous ? clicksByPage(db, current) : Promise.resolve([]),
    previous ? clicksByPage(db, previous) : Promise.resolve([]),
    previous
      ? db.query<{ query: string; clicks: number }>(
          `select query, sum(clicks)::int as clicks from spiral.gsc_daily
            where day between $1::date and $2::date group by query having sum(clicks) > 0`,
          [previous.start, previous.end],
        )
      : Promise.resolve([]),
  ]);

  // Per search: totals across its pages, and each page's share.
  type Agg = { clicks: number; impressions: number; posWeight: number; pages: Map<string, { impressions: number; posWeight: number; clicks: number }> };
  const bySearch = new Map<string, Agg>();
  for (const r of pairs) {
    const a = bySearch.get(r.query) ?? { clicks: 0, impressions: 0, posWeight: 0, pages: new Map() };
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    a.posWeight += r.position * r.impressions;
    const path = pagePath(r.page);
    const p = a.pages.get(path) ?? { impressions: 0, posWeight: 0, clicks: 0 };
    p.impressions += r.impressions;
    p.posWeight += r.position * r.impressions;
    p.clicks += r.clicks;
    a.pages.set(path, p);
    bySearch.set(r.query, a);
  }

  const opportunities: OpportunityRow[] = [];
  const competing: CompetingRow[] = [];
  let namedClicks = 0;
  for (const [query, a] of bySearch) {
    namedClicks += a.clicks;
    const position = a.impressions ? a.posWeight / a.impressions : 0;
    const group = searchGroup(query);
    const pages = [...a.pages.entries()].map(([path, p]) => ({
      path,
      impressions: p.impressions,
      position: p.impressions ? p.posWeight / p.impressions : 0,
    }));
    if (
      group === "recruiting" &&
      a.impressions >= OPPORTUNITY_MIN_SHOWN &&
      position >= OPPORTUNITY_POSITIONS.from &&
      position <= OPPORTUNITY_POSITIONS.to
    ) {
      const best = pages.sort((x, y) => y.impressions - x.impressions)[0];
      opportunities.push({ query, path: best?.path ?? "/", impressions: a.impressions, clicks: a.clicks, position });
    }
    const shown = pages.filter((p) => p.impressions >= COMPETING_MIN_SHOWN).sort((x, y) => x.position - y.position);
    // One page per result: the most-shown page of each group of pages at (about) the same position.
    const results: typeof shown = [];
    for (const p of shown) {
      const same = results.find((r) => Math.abs(r.position - p.position) < SAME_RESULT);
      if (!same) results.push(p);
      else if (p.impressions > same.impressions) results.splice(results.indexOf(same), 1, p);
    }
    if (results.length >= 2) {
      competing.push({ query, group, impressions: a.impressions, pages: results.sort((x, y) => x.position - y.position) });
    }
  }
  opportunities.sort((a, b) => b.impressions - a.impressions || a.position - b.position);
  competing.sort((a, b) => (a.group === "recruiting" ? 0 : 1) - (b.group === "recruiting" ? 0 : 1) || b.impressions - a.impressions);

  const BUCKETS: { key: string; label: string }[] = [
    { key: "top3", label: "Positions 1–3" },
    { key: "page1", label: "Positions 4–10 (rest of page one)" },
    { key: "page2", label: "Positions 11–20 (page two)" },
    { key: "deeper", label: "Position 21 or lower" },
  ];
  const positions: PositionBucket[] = BUCKETS.map((b) => {
    const r = buckets.find((x) => x.bucket === b.key);
    return { ...b, clicks: r?.clicks ?? 0, impressions: r?.impressions ?? 0 };
  });

  let movers: SearchDeep["movers"] = null;
  if (previous) {
    const searchesNow = new Map<string, number>();
    for (const [q, a] of bySearch) if (a.clicks > 0) searchesNow.set(q, a.clicks);
    movers = {
      pages: pickMovers(merge(pagesNow), merge(pagesBefore), (path) => pageGroup(path)),
      searches: pickMovers(searchesNow, new Map(queriesBefore.map((r) => [r.query, r.clicks])), (q) => searchGroup(q)),
    };
  }

  return {
    namedClicks,
    opportunities: {
      rows: opportunities.slice(0, 25),
      total: opportunities.length,
      impressions: opportunities.reduce((s, r) => s + r.impressions, 0),
      clicks: opportunities.reduce((s, r) => s + r.clicks, 0),
    },
    movers,
    competing: { rows: competing.slice(0, 15), total: competing.length, recruiting: competing.filter((c) => c.group === "recruiting").length },
    positions,
  };
}

function clicksByPage(db: Db, p: Period) {
  return db.query<{ page: string; clicks: number }>(
    `select page, sum(clicks)::int as clicks from spiral.gsc_daily_page
      where day between $1::date and $2::date group by page having sum(clicks) > 0`,
    [p.start, p.end],
  );
}

/** Page addresses come in a few spellings (http/https, www, trailing slash): merge them by path. */
function merge(rows: { page: string; clicks: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const path = pagePath(r.page);
    out.set(path, (out.get(path) ?? 0) + r.clicks);
  }
  return out;
}

/** The five biggest gains and the five biggest falls in clicks. */
function pickMovers(now: Map<string, number>, before: Map<string, number>, group: (key: string) => string): MoverRow[] {
  const keys = new Set([...now.keys(), ...before.keys()]);
  const rows: MoverRow[] = [];
  for (const key of keys) {
    const n = now.get(key) ?? 0;
    const b = before.get(key) ?? 0;
    if (Math.max(n, b) < MOVER_MIN_CLICKS || n === b) continue;
    rows.push({ key, label: key, group: group(key), now: n, before: b });
  }
  const up = rows.filter((r) => r.now > r.before).sort((a, b) => b.now - b.before - (a.now - a.before)).slice(0, 5);
  const down = rows.filter((r) => r.now < r.before).sort((a, b) => a.now - a.before - (b.now - b.before)).slice(0, 5);
  return [...up, ...down];
}

/** Friendly names for Google Analytics' source values, and what kind of source each is. */
const SOURCE_NAMES: { test: RegExp; label: string; kind: string }[] = [
  { test: /^\(direct\)$/, label: "Direct", kind: "Direct" },
  { test: /^google$/, label: "Google", kind: "Search engine" },
  { test: /^bing$/, label: "Bing", kind: "Search engine" },
  { test: /^(yahoo|duckduckgo|ecosia|yandex|baidu)$/, label: "Other search engines", kind: "Search engine" },
  { test: /chatgpt|openai/, label: "ChatGPT", kind: "AI assistant" },
  { test: /perplexity/, label: "Perplexity", kind: "AI assistant" },
  { test: /gemini|bard/, label: "Gemini", kind: "AI assistant" },
  { test: /claude\.ai|copilot/, label: "Other AI assistants", kind: "AI assistant" },
  { test: /instagram|^ig$/, label: "Instagram", kind: "Social" },
  { test: /facebook|^fb$|^m\.facebook/, label: "Facebook", kind: "Social" },
  { test: /linkedin|lnkd/, label: "LinkedIn", kind: "Social" },
  { test: /youtube/, label: "YouTube", kind: "Social" },
  { test: /tiktok/, label: "TikTok", kind: "Social" },
  { test: /(^t\.co$|twitter|^x\.com)/, label: "X (Twitter)", kind: "Social" },
  { test: /spiralny\.com/, label: "spiralny.com itself", kind: "Own site" },
];

/** Where visits came from, by site, with how many were engaged. */
export async function websiteSources(db: Db, p: Period): Promise<SourceDetailRow[]> {
  const rows = await db.query<{ source: string; medium: string; sessions: number; engaged: number }>(
    `select source, medium, sum(sessions)::int as sessions, sum(engaged_sessions)::int as engaged
       from spiral.ga4_daily where day between $1::date and $2::date group by source, medium`,
    [p.start, p.end],
  );
  const out = new Map<string, SourceDetailRow>();
  for (const r of rows) {
    const source = (r.source || "(not set)").toLowerCase();
    const known = SOURCE_NAMES.find((n) => n.test.test(source));
    const label = known?.label ?? (source === "(not set)" ? "Not known" : source.replace(/^www\./, ""));
    const kind = known?.kind ?? (/referral/.test(r.medium) ? "Another website" : r.medium === "email" ? "Email" : "Other");
    const row = out.get(label) ?? { key: label, label, kind, sessions: 0, engaged: 0 };
    row.sessions += r.sessions;
    row.engaged += r.engaged;
    out.set(label, row);
  }
  return [...out.values()].sort((a, b) => b.sessions - a.sessions);
}
