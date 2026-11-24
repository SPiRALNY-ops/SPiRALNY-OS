import { warmAnalytics } from "@/lib/analytics";
import { query } from "@/lib/db";
import { cronAuthError } from "@/lib/sync/cron-auth";

/**
 * Builds the Analytics view for every date range into the server's cache, so
 * the next visit is instant. Called by the server itself after each sync and
 * when it starts (cached work has to run inside a request, hence a route).
 * Also reports the database round trip, a quick check that the app and the
 * database sit in the same region.
 */
export async function POST(request: Request) {
  const denied = cronAuthError(request);
  if (denied) return denied;
  await query("select 1"); // opens a connection if none is idle
  let started = performance.now();
  await query("select 1");
  const dbRoundTripMs = Math.round((performance.now() - started) * 10) / 10;
  started = performance.now();
  await warmAnalytics();
  return Response.json({ status: "warm", ms: Math.round(performance.now() - started), dbRoundTripMs });
}
