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

export type GscQueryRow = { day: string; query: string; page: string; clicks: number; impressions: number; position: number };
export type GscPageRow = { day: string; page: string; clicks: number; impressions: number; position: number };

export async function fetchGscDaily(
  fetchFn: Fetch,
  accessToken: string,
  siteUrl: string,
  start: string,
  end: string,
): Promise<{ queries: GscQueryRow[]; pages: GscPageRow[] }> {
  const [byQuery, byPage] = await Promise.all([
    fetchGscRows(fetchFn, accessToken, siteUrl, start, end, ["date", "query", "page"]),
    fetchGscRows(fetchFn, accessToken, siteUrl, start, end, ["date", "page"]),
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
  };
}
