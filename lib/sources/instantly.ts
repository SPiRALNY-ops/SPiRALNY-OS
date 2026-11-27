/**
 * Instantly API v2 (read only; key scope all:read).
 * Shapes from https://api.instantly.ai/openapi/api_v2.json; auth and rate
 * limits from https://developer.instantly.ai/getting-started/.
 */
import { requestJson, type Fetch } from "./http";

const BASE = "https://api.instantly.ai/api/v2";

export const CAMPAIGN_STATUS: Record<string, string> = {
  "0": "Draft",
  "1": "Active",
  "2": "Paused",
  "3": "Completed",
  "4": "Running subsequences",
  "-99": "Account suspended",
  "-1": "Accounts unhealthy",
  "-2": "Bounce protect",
};

export const LEAD_STATUS: Record<string, string> = {
  "1": "Active",
  "2": "Paused",
  "3": "Completed",
  "-1": "Bounced",
  "-2": "Unsubscribed",
  "-3": "Skipped",
};

export const INTEREST_STATUS: Record<string, string> = {
  "0": "Out of office",
  "1": "Interested",
  "2": "Meeting booked",
  "3": "Meeting completed",
  "4": "Won",
  "-1": "Not interested",
  "-2": "Wrong person",
  "-3": "Lost",
  "-4": "No show",
};

export type InstantlyCampaign = { id: string; name: string; status: number; timestamp_created?: string };

export type InstantlyDaily = {
  date: string;
  sent?: number;
  contacted?: number;
  new_leads_contacted?: number;
  opened?: number;
  unique_opened?: number;
  replies?: number;
  unique_replies?: number;
  opportunities?: number;
  unique_opportunities?: number;
};

export type InstantlyLead = {
  id: string;
  email: string | null;
  campaign: string | null;
  status?: number;
  lt_interest_status?: number | null;
  timestamp_created?: string;
  timestamp_last_contact?: string | null;
  timestamp_last_reply?: string | null;
};

const auth = (apiKey: string) => ({ authorization: `Bearer ${apiKey}` });

export async function listCampaigns(fetchFn: Fetch, apiKey: string): Promise<InstantlyCampaign[]> {
  const out: InstantlyCampaign[] = [];
  let cursor: string | undefined;
  do {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("starting_after", cursor);
    const res = await requestJson<{ items?: InstantlyCampaign[]; next_starting_after?: string }>(
      fetchFn,
      `${BASE}/campaigns?${params}`,
      { service: "Instantly", headers: auth(apiKey) },
    );
    const items = res.items ?? [];
    out.push(...items);
    cursor = items.length ? res.next_starting_after : undefined;
  } while (cursor);
  return out;
}

/** Daily numbers for one campaign. Dates are UTC days. */
export async function campaignDaily(
  fetchFn: Fetch,
  apiKey: string,
  campaignId: string,
  start: string,
  end: string,
): Promise<InstantlyDaily[]> {
  const params = new URLSearchParams({ campaign_id: campaignId, start_date: start, end_date: end });
  const res = await requestJson<InstantlyDaily[]>(fetchFn, `${BASE}/campaigns/analytics/daily?${params}`, {
    service: "Instantly",
    headers: auth(apiKey),
  });
  return Array.isArray(res) ? res : [];
}

export type InstantlyCampaignTotals = {
  campaign_id: string;
  campaign_name?: string;
  emails_sent_count?: number;
  contacted_count?: number;
  reply_count_unique?: number;
  bounced_count?: number;
  unsubscribed_count?: number;
  total_opportunities?: number;
};

export type InstantlyOverview = {
  emails_sent_count?: number;
  contacted_count?: number;
  new_leads_contacted_count?: number;
  reply_count_unique?: number;
  /** Out-of-office and other automatic replies, each person once. */
  reply_count_automatic_unique?: number;
  bounced_count?: number;
  unsubscribed_count?: number;
  total_interested?: number;
  total_meeting_booked?: number;
  total_meeting_completed?: number;
  total_closed?: number;
};

/** All campaigns together for one date range (GET /campaigns/analytics/overview, no id = all). */
export async function campaignOverview(fetchFn: Fetch, apiKey: string, start: string, end: string): Promise<InstantlyOverview> {
  const params = new URLSearchParams({ start_date: start, end_date: end });
  const res = await requestJson<InstantlyOverview | InstantlyOverview[]>(fetchFn, `${BASE}/campaigns/analytics/overview?${params}`, {
    service: "Instantly",
    headers: auth(apiKey),
  });
  return (Array.isArray(res) ? res[0] : res) ?? {};
}

export type InstantlyStep = {
  // Sent as text in practice ("0", "1", sometimes "null"), though the spec says number. 0 = the first email.
  step: number | string | null;
  variant: number | string | null; // 0 = A
  sent?: number;
  unique_replies?: number;
  unique_opportunities?: number;
};

/** Per email of one campaign's sequence for a date range. */
export async function campaignSteps(fetchFn: Fetch, apiKey: string, campaignId: string, start: string, end: string): Promise<InstantlyStep[]> {
  const params = new URLSearchParams({ campaign_id: campaignId, start_date: start, end_date: end, include_opportunities_count: "true" });
  const res = await requestJson<InstantlyStep[]>(fetchFn, `${BASE}/campaigns/analytics/steps?${params}`, {
    service: "Instantly",
    headers: auth(apiKey),
  });
  return Array.isArray(res) ? res : [];
}

/** Instantly's own totals per campaign for one date range (UTC days, inclusive), as its screens show them. */
export async function campaignTotals(fetchFn: Fetch, apiKey: string, start: string, end: string): Promise<InstantlyCampaignTotals[]> {
  const params = new URLSearchParams({ start_date: start, end_date: end, exclude_total_leads_count: "true" });
  const res = await requestJson<InstantlyCampaignTotals[]>(fetchFn, `${BASE}/campaigns/analytics?${params}`, {
    service: "Instantly",
    headers: auth(apiKey),
  });
  return Array.isArray(res) ? res : [];
}

/** Every Instantly lead (any campaign) whose email is in `emails`. */
export async function findLeadsByEmail(fetchFn: Fetch, apiKey: string, emails: string[]): Promise<InstantlyLead[]> {
  const out: InstantlyLead[] = [];
  for (let i = 0; i < emails.length; i += 50) {
    const contacts = emails.slice(i, i + 50);
    let cursor: string | undefined;
    do {
      const res = await requestJson<{ items?: InstantlyLead[]; next_starting_after?: string }>(
        fetchFn,
        `${BASE}/leads/list`,
        {
          service: "Instantly",
          method: "POST",
          headers: auth(apiKey),
          json: { contacts, limit: 100, ...(cursor ? { starting_after: cursor } : {}) },
        },
      );
      const items = res.items ?? [];
      out.push(...items);
      cursor = items.length === 100 ? res.next_starting_after : undefined;
    } while (cursor);
  }
  return out;
}
