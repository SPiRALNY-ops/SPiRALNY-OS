/**
 * The daily sync: runs each connected source in order and logs every run.
 * A source whose access isn't set up yet is reported as "not-ready" and
 * leaves no log row, so the Analytics tab keeps its sample data.
 */
import { parseKey } from "@/lib/crypto";
import type { Db } from "@/lib/db/types";
import { getGoogleConnection, googleAccessToken, type GoogleConnection } from "@/lib/sources/google-account";
import { GOOGLE_SCOPES } from "@/lib/sources/google-oauth";
import type { Fetch } from "@/lib/sources/http";
import { syncForms } from "./forms";
import { syncGa4 } from "./ga4";
import { syncGsc } from "./gsc";
import { syncInstantly } from "./instantly";
import { syncLeadSheet } from "./lead-sheet";
import { acquireLease, releaseLease, renewLease } from "./lease";
import { closeStaleRuns, recordRun } from "./store";
import { SYNC_ORDER, type RunSummary, type SourceResult, type SyncConfig, type SyncContext, type SyncSource } from "./types";

export type Readiness = { ready: true } | { ready: false; reason: string };

/** What each source still needs before it can sync. */
export function sourceReadiness(config: SyncConfig, google: GoogleConnection | null): Record<SyncSource, Readiness> {
  const googleReady = (scope: string, label: string): Readiness => {
    if (!config.google) return { ready: false, reason: "Google OAuth client isn't configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)." };
    if (!config.encryptionKey) return { ready: false, reason: "APP_ENCRYPTION_KEY isn't set." };
    if (!google) return { ready: false, reason: "Google isn't connected yet." };
    if (!google.scopes.includes(scope)) return { ready: false, reason: `Reconnect Google and allow ${label}.` };
    return { ready: true };
  };
  const ga4 = googleReady(GOOGLE_SCOPES.ga4, "Google Analytics");
  return {
    forms: googleReady(GOOGLE_SCOPES.gmail, "Gmail"),
    lead_sheet: (() => {
      const r = googleReady(GOOGLE_SCOPES.sheets, "Google Sheets");
      return r.ready && !config.leadSheetId ? { ready: false as const, reason: "LEAD_SHEET_ID isn't set." } : r;
    })(),
    instantly: config.instantlyApiKey ? { ready: true } : { ready: false, reason: "INSTANTLY_API_KEY isn't set." },
    gsc: googleReady(GOOGLE_SCOPES.gsc, "Search Console"),
    ga4: ga4.ready && !config.ga4PropertyId ? { ready: false, reason: "GA4_PROPERTY_ID isn't set." } : ga4,
  };
}

const STEPS: Record<SyncSource, (ctx: SyncContext) => Promise<SourceResult>> = {
  forms: syncForms,
  lead_sheet: syncLeadSheet,
  instantly: syncInstantly,
  gsc: syncGsc,
  ga4: syncGa4,
};

export async function runSync(
  deps: { db: Db; fetch: Fetch; today: string; config: SyncConfig },
  only?: SyncSource[],
): Promise<RunSummary[]> {
  const { db } = deps;
  // Only one sync at a time, even across two servers (during a deploy both run for a while).
  const lease = await acquireLease(db);
  if (!lease) return [];
  try {
    return await runSteps(deps, only, lease);
  } finally {
    await releaseLease(db, lease);
  }
}

async function runSteps(
  deps: { db: Db; fetch: Fetch; today: string; config: SyncConfig },
  only: SyncSource[] | undefined,
  lease: { holder: string },
): Promise<RunSummary[]> {
  const { db, config } = deps;
  // Holding the lease, any run still marked "running" belongs to a sync that died mid-way.
  await closeStaleRuns(db);
  const google = await getGoogleConnection(db);
  const readiness = sourceReadiness(config, google);

  const ctx: SyncContext = { ...deps, heartbeat: () => renewLease(db, lease) };
  if (config.google && config.encryptionKey && google) {
    const key = parseKey(config.encryptionKey);
    ctx.googleToken = () => googleAccessToken(db, deps.fetch, config.google!, key);
  }

  const results: RunSummary[] = [];
  for (const source of SYNC_ORDER) {
    if (only && !only.includes(source)) continue;
    const r = readiness[source];
    if (!r.ready) {
      results.push({ source, status: "not-ready", rows: 0, message: r.reason });
      continue;
    }
    results.push(await recordRun(db, source, () => STEPS[source](ctx)));
    await ctx.heartbeat!();
  }
  return results;
}

export type { RunSummary, SyncConfig, SyncSource } from "./types";
