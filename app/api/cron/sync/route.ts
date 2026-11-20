import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { startSync } from "@/lib/sync/server";

/**
 * Called every morning by the Railway cron service (scripts/cron-sync.mjs)
 * with "Authorization: Bearer <CRON_SECRET>". Starts the sync and answers at
 * once; progress and results are logged in spiral.sync_runs.
 */
export async function POST(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const status = startSync();
  return Response.json({ status }, { status: status === "started" ? 202 : 409 });
}
