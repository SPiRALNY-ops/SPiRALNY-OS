import { CircleCheck, Clock, LoaderCircle, TriangleAlert } from "lucide-react";
import { disconnectGoogle, syncNow } from "@/app/(os)/analytics/actions";
import { Button } from "@/components/ui/button";
import { plural, relativeTime } from "@/lib/format";
import type { ConnectionsStatus, LastRun } from "@/lib/sync/server";
import type { SyncSource } from "@/lib/sync/types";
import { DisconnectButton, RefreshWhileRunning, SyncNowButton } from "./connections-controls";

const SOURCE_LABEL: Record<SyncSource, string> = {
  forms: "Sign-up form entries (from Gmail)",
  lead_sheet: "Lead sheet (Google Sheets)",
  instantly: "Instantly",
  gsc: "Google Search Console",
  ga4: "Google Analytics",
};

const NOTICES: Record<string, string> = {
  connected: "Google is connected. The first sync has started.",
  denied: "Google sign-in was cancelled.",
  "state-mismatch": "That Google sign-in link expired. Press Connect Google again.",
  "not-configured": "Google sign-in isn't set up on the server yet (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_ENCRYPTION_KEY).",
  "no-refresh-token": "Google didn't grant lasting access. Press Connect Google again.",
  failed: "Connecting Google failed. The server log has the details.",
  forbidden: "Only OpsLabs can connect Google.",
  "wrong-account": "That Google account isn't the one set for Spiral OS (GOOGLE_ACCOUNT_EMAIL), so it wasn't connected.",
};

/** OpsLabs only: Google connection, per-source sync health, and "Sync now". */
export function ConnectionsPanel({ status, notice }: { status: ConnectionsStatus; notice?: string }) {
  const { google } = status;
  const anyReady = status.sources.some((s) => s.readiness.ready);
  // "connected" comes from the URL after the Google redirect; only trust it if the connection exists.
  const message = notice && !(notice === "connected" && !google) ? NOTICES[notice] : undefined;

  return (
    <section id="connections" aria-labelledby="connections-title" className="scroll-mt-20 rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <RefreshWhileRunning running={status.running} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="connections-title" className="text-base font-bold">
              Connections
            </h2>
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">OpsLabs only</span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">Where the numbers above come from, and when each source last synced.</p>
        </div>
        <form action={syncNow}>
          <SyncNowButton running={status.running} disabled={!anyReady} />
        </form>
      </header>

      {message && (
        <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">
          {message}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
        <div className="min-w-0 text-sm">
          <p className="font-medium">Google</p>
          <p className="text-muted-foreground">
            {google
              ? `Connected as ${google.accountEmail ?? "an unknown account"}, ${relativeTime(google.connectedAt)}`
              : status.googleClientConfigured
                ? "Not connected. Sign in as admin@outreachify.io."
                : "Not set up on the server yet (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_ENCRYPTION_KEY)."}
          </p>
          {google?.lastError && (
            <p className="mt-1 flex items-start gap-1.5 text-bad">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>Google access stopped working. Reconnect Google.</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status.googleClientConfigured && (
            // A plain GET form: a full browser navigation to Google's consent screen, never prefetched.
            <form action="/api/google/connect" method="get">
              <Button type="submit" size="sm" variant={google ? "outline" : "default"}>
                {google ? "Reconnect" : "Connect Google"}
              </Button>
            </form>
          )}
          {google && (
            <form action={disconnectGoogle}>
              <DisconnectButton />
            </form>
          )}
        </div>
      </div>

      <ul className="mt-3 divide-y">
        {status.sources.map((s) => (
          <li key={s.key} className="flex items-start gap-2.5 py-2.5 text-sm">
            <SourceIcon ready={s.readiness.ready} run={s.lastRun} running={status.running} />
            <div className="min-w-0">
              <p className="font-medium">{SOURCE_LABEL[s.key]}</p>
              <p className="text-muted-foreground">{describe(s.readiness, s.lastRun)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceIcon({ ready, run, running }: { ready: boolean; run: LastRun | null; running: boolean }) {
  const cls = "mt-0.5 size-4 shrink-0";
  if (run?.status === "running" || (running && ready && !run)) {
    return <LoaderCircle aria-hidden className={`${cls} animate-spin text-muted-foreground`} />;
  }
  if (!ready || !run || run.status === "skipped") return <Clock aria-hidden className={`${cls} text-muted-foreground`} />;
  if (run.status === "error") return <TriangleAlert aria-hidden className={`${cls} text-bad`} />;
  return <CircleCheck aria-hidden className={`${cls} text-good`} />;
}

function describe(readiness: { ready: boolean; reason?: string }, run: LastRun | null): string {
  if (!readiness.ready) return `Not ready: ${readiness.reason}`;
  if (!run) return "Ready. Not synced yet.";
  const when = relativeTime(run.finishedAt ?? run.startedAt);
  switch (run.status) {
    case "running":
      return "Syncing now…";
    case "success":
      return `Synced ${when}: ${plural(run.rows, "row", "rows")}.${run.message ? ` ${run.message}` : ""}`;
    case "skipped":
      return `Checked ${when}: ${run.message ?? "nothing to show yet."} Sample data stays on until real data arrives.`;
    case "error":
      return `Last sync failed ${when}: ${run.message ?? "unknown error"}`;
  }
}
