import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Checks "Authorization: Bearer <CRON_SECRET>" on the background routes (the
 * in-process scheduler and any outside scheduler call them). Returns an error
 * response to send back, or null when the caller is allowed.
 */
export function cronAuthError(request: Request): Response | null {
  const secret = env().CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  return null;
}
