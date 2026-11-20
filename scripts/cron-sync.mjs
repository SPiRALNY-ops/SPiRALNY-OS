// Railway cron service: asks the web service to run the daily sync, then exits
// (Railway cron jobs must finish and exit; schedules are in UTC).
// Needs APP_URL and CRON_SECRET. Plain Node, so it runs in the production image.
const { APP_URL, CRON_SECRET } = process.env;
if (!APP_URL || !CRON_SECRET) {
  console.error("APP_URL and CRON_SECRET must be set.");
  process.exit(1);
}

const res = await fetch(new URL("/api/cron/sync", APP_URL), {
  method: "POST",
  headers: { authorization: `Bearer ${CRON_SECRET}` },
  signal: AbortSignal.timeout(30_000),
});
console.log(`sync request: HTTP ${res.status} ${await res.text()}`);
// 409 = a sync is already running, which is fine.
process.exit(res.status === 202 || res.status === 409 ? 0 : 1);
