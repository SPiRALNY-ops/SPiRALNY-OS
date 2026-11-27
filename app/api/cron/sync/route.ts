import { cronAuthError } from "@/lib/sync/cron-auth";
import { dueSources, startSync } from "@/lib/sync/server";
import { SYNC_ORDER } from "@/lib/sync/types";

/**
 * Starts the sync and answers at once; progress and results are logged in
 * spiral.sync_runs. Called with "Authorization: Bearer <CRON_SECRET>".
 * `?when=due` (the in-process scheduler, every few minutes) only starts it if
 * the sources today's morning sync hasn't finished yet, so a restart or deploy never skips or repeats a day.
 */
export async function POST(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;

  let only: (typeof SYNC_ORDER)[number][] | undefined;
  if (new URL(request.url).searchParams.get("when") === "due") {
    const due = await dueSources();
    if (!due.length) return Response.json({ status: "not-due" });
    // Only the sources today's morning sync hasn't finished (all of them, the first time).
    if (due.length < SYNC_ORDER.length) only = due;
  }
  const status = startSync(only);
  return Response.json({ status }, { status: status === "started" ? 202 : 409 });
}
