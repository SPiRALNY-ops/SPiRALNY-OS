import { cronAuthError } from "@/lib/sync/cron-auth";
import { startSync, syncDue } from "@/lib/sync/server";

/**
 * Starts the sync and answers at once; progress and results are logged in
 * spiral.sync_runs. Called with "Authorization: Bearer <CRON_SECRET>".
 * `?when=due` (the in-process scheduler, every few minutes) only starts it if
 * today's morning sync hasn't run yet, so a restart never skips or repeats a day.
 */
export async function POST(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  if (new URL(request.url).searchParams.get("when") === "due" && !(await syncDue())) {
    return Response.json({ status: "not-due" });
  }
  const status = startSync();
  return Response.json({ status }, { status: status === "started" ? 202 : 409 });
}
