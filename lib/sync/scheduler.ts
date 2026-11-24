import { callSelf } from "./self";

/** How often the server asks itself whether the morning sync is due (it runs once a day, after 6 AM New York). */
const CHECK_EVERY_MS = 10 * 60 * 1000;

/**
 * The daily schedule, run inside the web server (started from instrumentation.ts):
 *  - once the server answers, build every Analytics range into the cache;
 *  - then every 10 minutes ask /api/cron/sync?when=due, which starts the day's
 *    sync once it's past 6 AM in New York and today's hasn't run.
 * Asking repeatedly (instead of firing at one fixed minute) means a restart or
 * deploy at the wrong moment never skips a day.
 */
export function startScheduler(): void {
  const holder = globalThis as unknown as { __spiralScheduler?: boolean };
  if (holder.__spiralScheduler || !process.env.CRON_SECRET) return;
  holder.__spiralScheduler = true;

  const log = (msg: string) => console.log(`[scheduler] ${msg}`);
  const checkDue = async () => {
    try {
      const res = await callSelf("/api/cron/sync?when=due", 30_000);
      const body = res ? ((await res.json()) as { status?: string }) : null;
      if (body?.status && body.status !== "not-due") log(`daily sync: ${body.status}`);
    } catch (error) {
      log(`due check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const boot = async (attempt = 1): Promise<void> => {
    try {
      const res = await callSelf("/api/cron/warm");
      if (!res?.ok) throw new Error(`HTTP ${res?.status}`);
      log(`cache warmed: ${JSON.stringify(await res.json())}`);
    } catch (error) {
      // The server may not be listening yet right after start; try again shortly.
      if (attempt < 10) return void setTimeout(() => void boot(attempt + 1), 3000);
      log(`warm-up gave up: ${error instanceof Error ? error.message : String(error)}`);
    }
    await checkDue();
    setInterval(() => void checkDue(), CHECK_EVERY_MS).unref();
  };
  setTimeout(() => void boot(), 1500).unref();
}
