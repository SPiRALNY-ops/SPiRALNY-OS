/**
 * Calls one of this server's own background routes (/api/cron/*) over
 * localhost with the cron secret. Plain module on purpose (no "server-only"),
 * because instrumentation.ts imports it too.
 */
export async function callSelf(path: `/api/cron/${string}`, timeoutMs = 180_000): Promise<Response | null> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return null;
  const port = process.env.PORT || "3000";
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
}
