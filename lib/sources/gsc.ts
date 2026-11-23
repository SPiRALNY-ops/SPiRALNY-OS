/**
 * Search Console API, searchanalytics.query.
 * Shapes from https://searchconsole.googleapis.com/$discovery/rest?version=v1 and
 * https://developers.google.com/webmaster-tools/v1/searchanalytics/query.
 * Dates are Pacific time; only final data is requested (the default dataState).
 */
import { requestJson, type Fetch } from "./http";

const ROW_LIMIT = 25_000; // the API maximum per request

export type GscDimension = "date" | "query" | "page";
export type GscApiRow = { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number };

export async function fetchGscRows(
  fetchFn: Fetch,
  accessToken: string,
  siteUrl: string,
  start: string,
  end: string,
  dimensions: GscDimension[],
): Promise<GscApiRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const all: GscApiRow[] = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const res = await requestJson<{ rows?: GscApiRow[] }>(fetchFn, url, {
      service: "Search Console",
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      json: { startDate: start, endDate: end, dimensions, type: "web", rowLimit: ROW_LIMIT, startRow },
    });
    const rows = res.rows ?? [];
    all.push(...rows);
    if (rows.length < ROW_LIMIT) break;
  }
  return all;
}

export type GscSite = { siteUrl: string; permissionLevel: string };

/** Search Console properties the signed-in account can see (sites.list). */
export async function listSites(fetchFn: Fetch, accessToken: string): Promise<GscSite[]> {
  const res = await requestJson<{ siteEntry?: GscSite[] }>(fetchFn, "https://searchconsole.googleapis.com/webmasters/v3/sites", {
    service: "Search Console",
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return res.siteEntry ?? [];
}

/**
 * The spiralny.com property to read: the domain property if the account has it,
 * else the https URL-prefix one, else any other verified spiralny.com property.
 */
export function pickSpiralSite(sites: GscSite[]): string | null {
  const usable = sites.filter((s) => s.permissionLevel !== "SITE_UNVERIFIED_USER");
  const prefer = ["sc-domain:spiralny.com", "https://spiralny.com/", "https://www.spiralny.com/"];
  for (const url of prefer) if (usable.some((s) => s.siteUrl === url)) return url;
  return usable.find((s) => s.siteUrl.includes("spiralny.com"))?.siteUrl ?? null;
}

export type GscQueryRow = { day: string; query: string; page: string; clicks: number; impressions: number; position: number };
export type GscPageRow = { day: string; page: string; clicks: number; impressions: number; position: number };
export type GscSiteRow = { day: string; clicks: number; impressions: number; position: number };

export async function fetchGscDaily(
  fetchFn: Fetch,
  accessToken: string,
  siteUrl: string,
  start: string,
  end: string,
): Promise<{ queries: GscQueryRow[]; pages: GscPageRow[]; site: GscSiteRow[] }> {
  const [byQuery, byPage, bySite] = await Promise.all([
    fetchGscRows(fetchFn, accessToken, siteUrl, start, end, ["date", "query", "page"]),
    fetchGscRows(fetchFn, accessToken, siteUrl, start, end, ["date", "page"]),
    // Grouped by date only = the property's own totals (what the Performance report shows).
    fetchGscRows(fetchFn, accessToken, siteUrl, start, end, ["date"]),
  ]);
  const metrics = (r: GscApiRow) => ({
    clicks: Math.round(r.clicks ?? 0),
    impressions: Math.round(r.impressions ?? 0),
    position: Number(r.position ?? 0),
  });
  return {
    queries: byQuery
      .filter((r) => r.keys?.length === 3)
      .map((r) => ({ day: r.keys![0], query: r.keys![1], page: r.keys![2], ...metrics(r) })),
    pages: byPage
      .filter((r) => r.keys?.length === 2)
      .map((r) => ({ day: r.keys![0], page: r.keys![1], ...metrics(r) })),
    site: bySite.filter((r) => r.keys?.length === 1).map((r) => ({ day: r.keys![0], ...metrics(r) })),
  };
}
