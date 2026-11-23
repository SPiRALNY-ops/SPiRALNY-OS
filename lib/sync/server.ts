import "server-only";
import { after } from "next/server";
import { todayIn } from "@/lib/analytics/range";
import { getDb } from "@/lib/db";
import { env } from "@/lib/env";
import { getGoogleConnection, type GoogleConnection } from "@/lib/sources/google-account";
import { runSync, sourceReadiness, type Readiness } from "./index";
import { SYNC_ORDER, type RunSummary, type SyncConfig, type SyncSource } from "./types";

export function syncConfigFromEnv(): SyncConfig {
  const e = env();
  return {
    timezone: e.TIMEZONE,
    encryptionKey: e.APP_ENCRYPTION_KEY,
    google: e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET ? { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } : undefined,
    ga4PropertyId: e.GA4_PROPERTY_ID,
    gscSiteUrl: e.GSC_SITE_URL,
    leadSheetId: e.LEAD_SHEET_ID,
    gmailQuery: e.GMAIL_FORMS_QUERY,
    instantlyApiKey: e.INSTANTLY_API_KEY,
  };
}

// One sync at a time per server (Railway runs a single web instance).
const holder = globalThis as unknown as { __spiralSync?: Promise<RunSummary[]> };

export function isSyncRunning(): boolean {
  return Boolean(holder.__spiralSync);
}

/**
 * Starts a sync in the background and returns at once. Must be called from a
 * Route Handler or Server Action: `after` keeps the work alive past the response.
 */
export function startSync(only?: SyncSource[]): "started" | "already-running" {
  if (holder.__spiralSync) return "already-running";
  const config = syncConfigFromEnv();
  const run = (async () => {
    const db = await getDb();
    const results = await runSync({ db, fetch, today: todayIn(config.timezone), config }, only);
    for (const r of results) {
      if (r.status === "error") console.error(`[sync] ${r.source}: ${r.message}`);
    }
    return results;
  })().finally(() => {
    holder.__spiralSync = undefined;
  });
  holder.__spiralSync = run;
  after(() => run.catch((error) => console.error("[sync] failed", error)));
  return "started";
}

export type LastRun = {
  status: "running" | "success" | "error" | "skipped";
  startedAt: string;
  finishedAt: string | null;
  rows: number;
  message: string | null;
};

export type ConnectionsStatus = {
  google: GoogleConnection | null;
  googleClientConfigured: boolean;
  running: boolean;
  sources: { key: SyncSource; readiness: Readiness; lastRun: LastRun | null }[];
};

/** For the OpsLabs connections panel. */
export async function getConnectionsStatus(): Promise<ConnectionsStatus> {
  const db = await getDb();
  const config = syncConfigFromEnv();
  const google = await getGoogleConnection(db);
  const readiness = sourceReadiness(config, google);
  const runs = await db.query<{
    source: SyncSource;
    status: LastRun["status"];
    started_at: Date | string;
    finished_at: Date | string | null;
    rows_written: number;
    message: string | null;
  }>(
    `select distinct on (source) source, status, started_at, finished_at, rows_written, message
       from spiral.sync_runs order by source, started_at desc`,
  );
  const bySource = new Map(runs.map((r) => [r.source, r]));
  return {
    google,
    googleClientConfigured: Boolean(config.google && config.encryptionKey),
    running: isSyncRunning() || runs.some((r) => r.status === "running"),
    sources: SYNC_ORDER.map((key) => {
      const r = bySource.get(key);
      return {
        key,
        readiness: readiness[key],
        lastRun: r
          ? {
              status: r.status,
              startedAt: new Date(r.started_at).toISOString(),
              finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
              rows: r.rows_written,
              message: r.message,
            }
          : null,
      };
    }),
  };
}
