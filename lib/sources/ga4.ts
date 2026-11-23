/**
 * Google Analytics Data API v1beta, properties.runReport.
 * Request/response shapes from https://analyticsdata.googleapis.com/$discovery/rest?version=v1beta;
 * dimension and metric names from https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema.
 */
import { requestJson, type Fetch } from "./http";

const DIMENSIONS = ["date", "landingPage", "sessionDefaultChannelGroup", "sessionSource", "sessionMedium", "deviceCategory"];
const METRICS = ["sessions", "engagedSessions", "totalUsers"];
const PAGE_SIZE = 100_000; // the API returns at most 250,000 rows per request

export type Ga4DailyRow = {
  day: string;
  landing_page: string;
  channel_group: string;
  source: string;
  medium: string;
  device: string;
  sessions: number;
  engaged_sessions: number;
  users: number;
};

type RunReportResponse = {
  rows?: { dimensionValues: { value?: string }[]; metricValues: { value?: string }[] }[];
  rowCount?: number;
};

export type Ga4SiteRow = { day: string; sessions: number; engaged_sessions: number; users: number };

/** The property's own daily totals (date as the only dimension), as Google Analytics reports them. */
export async function fetchGa4SiteDaily(
  fetchFn: Fetch,
  accessToken: string,
  propertyId: string,
  start: string,
  end: string,
): Promise<Ga4SiteRow[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const res = await requestJson<RunReportResponse>(fetchFn, url, {
    service: "Google Analytics",
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}` },
    json: {
      dateRanges: [{ startDate: start, endDate: end }],
      dimensions: [{ name: "date" }],
      metrics: METRICS.map((name) => ({ name })),
      limit: "100000",
    },
  });
  return (res.rows ?? []).map((r) => {
    const [sessions, engaged, users] = r.metricValues.map((m) => Math.round(Number(m.value ?? 0)) || 0);
    return { day: ga4Date(r.dimensionValues[0]?.value ?? ""), sessions, engaged_sessions: engaged, users };
  });
}

/** "20261119" -> "2026-11-19" */
export function ga4Date(value: string): string {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : value;
}

export async function fetchGa4Daily(
  fetchFn: Fetch,
  accessToken: string,
  propertyId: string,
  start: string,
  end: string,
): Promise<Ga4DailyRow[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(propertyId)}:runReport`;
  const merged = new Map<string, Ga4DailyRow>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await requestJson<RunReportResponse>(fetchFn, url, {
      service: "Google Analytics",
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}` },
      json: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: DIMENSIONS.map((name) => ({ name })),
        metrics: METRICS.map((name) => ({ name })),
        limit: String(PAGE_SIZE),
        offset: String(offset),
      },
    });
    const rows = res.rows ?? [];
    for (const r of rows) {
      const [date, page, channel, source, medium, device] = r.dimensionValues.map((d) => d.value || "(not set)");
      const [sessions, engaged, users] = r.metricValues.map((m) => Math.round(Number(m.value ?? 0)) || 0);
      const row: Ga4DailyRow = {
        day: ga4Date(date),
        landing_page: page,
        channel_group: channel,
        source,
        medium,
        device,
        sessions,
        engaged_sessions: engaged,
        users,
      };
      const key = [row.day, page, channel, source, medium, device].join("\u0000");
      const prev = merged.get(key);
      if (prev) {
        prev.sessions += sessions;
        prev.engaged_sessions += engaged;
        prev.users += users;
      } else merged.set(key, row);
    }
    if (rows.length < PAGE_SIZE || offset + rows.length >= (res.rowCount ?? 0)) break;
  }
  return [...merged.values()];
}
