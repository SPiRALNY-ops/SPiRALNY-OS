/**
 * Google Sheets API v4 (read only): tab names, then the values of chosen tabs.
 * Shapes from https://sheets.googleapis.com/$discovery/rest?version=v4
 * (spreadsheets.get with the standard `fields` parameter; spreadsheets.values.batchGet).
 */
import { requestJson, type Fetch } from "./http";

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

export async function sheetTitles(fetchFn: Fetch, accessToken: string, spreadsheetId: string): Promise<string[]> {
  const res = await requestJson<{ sheets?: { properties?: { title?: string } }[] }>(
    fetchFn,
    `${BASE}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    { service: "Google Sheets", headers: { authorization: `Bearer ${accessToken}` } },
  );
  return (res.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

/** A whole tab in A1 notation: the title in single quotes, inner quotes doubled. */
export const wholeTab = (title: string) => `'${title.replaceAll("'", "''")}'`;

/**
 * Cell values of each tab, by title. Unformatted, so real date cells arrive as
 * serial numbers and numbers as numbers; text stays text.
 */
export async function readTabs(
  fetchFn: Fetch,
  accessToken: string,
  spreadsheetId: string,
  titles: string[],
): Promise<Record<string, unknown[][]>> {
  if (!titles.length) return {};
  const params = new URLSearchParams({
    majorDimension: "ROWS",
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  for (const t of titles) params.append("ranges", wholeTab(t));
  const res = await requestJson<{ valueRanges?: { values?: unknown[][] }[] }>(
    fetchFn,
    `${BASE}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`,
    { service: "Google Sheets", headers: { authorization: `Bearer ${accessToken}` } },
  );
  const out: Record<string, unknown[][]> = {};
  titles.forEach((t, i) => (out[t] = res.valueRanges?.[i]?.values ?? []));
  return out;
}
