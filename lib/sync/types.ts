import type { Db } from "@/lib/db/types";
import type { GoogleClient } from "@/lib/sources/google-oauth";
import type { Fetch } from "@/lib/sources/http";

/** Sources the daily sync fills. */
export type SyncSource = "forms" | "lead_sheet" | "instantly" | "gsc" | "ga4";

/** Run order: form entries and the lead sheet first, so the Instantly step can match their emails in the same run. */
export const SYNC_ORDER: SyncSource[] = ["forms", "lead_sheet", "instantly", "gsc", "ga4"];

export type SyncConfig = {
  timezone: string;
  encryptionKey?: string;
  google?: GoogleClient;
  ga4PropertyId?: string;
  /** Search Console property; when unset, picked from the properties the account can read. */
  gscSiteUrl?: string;
  leadSheetId?: string;
  gmailQuery: string;
  instantlyApiKey?: string;
};

export type SyncContext = {
  db: Db;
  fetch: Fetch;
  /** Today's date in the app time zone (YYYY-MM-DD). */
  today: string;
  config: SyncConfig;
  /** Access token for the stored Google connection (set when Google is connected). */
  googleToken?: () => Promise<string>;
  /** Renews the sync lease; long steps call it between their parts. */
  heartbeat?: () => Promise<void>;
};

/**
 * "success" = data was written and the source now shows real numbers.
 * "skipped" = connected but nothing to show yet (e.g. no form emails so far),
 * so the Analytics tab keeps the labelled sample data instead of real zeros.
 */
export type SourceResult = {
  status: "success" | "skipped";
  rows: number;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  message?: string;
};

export type RunSummary = {
  source: SyncSource;
  status: "success" | "skipped" | "error" | "not-ready";
  rows: number;
  message?: string;
};
