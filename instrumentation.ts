/**
 * Runs once when the server starts. In production it starts the daily sync
 * schedule and warms the Analytics cache (lib/sync/scheduler.ts). Nothing is
 * awaited here, so the server starts taking requests at once.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { startScheduler } = await import("./lib/sync/scheduler");
  startScheduler();
}
