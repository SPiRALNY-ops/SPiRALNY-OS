import type { Db } from "@/lib/db/types";
import type { GoogleClient } from "@/lib/sources/google-oauth";
import type { Fetch } from "@/lib/sources/http";

/** Sources the daily sync fills. ("lead_sheet" comes with the Leads tab.) */
export type SyncSource = "forms" | "instantly" | "gsc" | "ga4";

/** Run order: form entries first, so the Instantly step can match them to campaigns in the same run. */
export const SYNC_ORDER: SyncSource[] = ["forms", "instantly", "gsc", "ga4"];

export type SyncConfig = {
  timezone: string;
  encryptionKey?: string;
  google?: GoogleClient;
  ga4PropertyId?: string;
  gscSiteUrl: string;
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
