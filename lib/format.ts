/** Number and date formatting shared by the UI. */

const whole = new Intl.NumberFormat("en-US");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** 1,284 in full under 10,000; 12.9K / 4.2M above. */
export function formatCount(n: number): string {
  return Math.abs(n) < 10_000 ? whole.format(Math.round(n)) : compact.format(n);
}

export function formatFull(n: number): string {
  return whole.format(Math.round(n));
}

export function formatPercent(ratio: number, digits = 1): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function formatPosition(p: number): string {
  return p > 0 ? p.toFixed(1) : "—";
}

/** Change vs the previous period: { pct: 0.12 } = +12%; null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/** "https://spiralny.com/brooklyn-100-commission-brokerage/?x=1" -> "/brooklyn-100-commission-brokerage/" */
export function pagePath(urlOrPath: string): string {
  try {
    const url = new URL(urlOrPath, "https://spiralny.com");
    const path = url.pathname || "/";
    return path.endsWith("/") ? path : `${path}/`;
  } catch {
    return urlOrPath;
  }
}
