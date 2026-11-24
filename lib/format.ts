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

/** A share of a whole, in whole percent; a tiny non-zero share reads "<1%", never "0%". */
export function formatShare(ratio: number): string {
  if (!Number.isFinite(ratio)) return "—";
  if (ratio > 0 && ratio < 0.005) return "<1%";
  return `${Math.round(ratio * 100)}%`;
}

/** Whole-number percentages of the total that add up to exactly 100 (largest remainder). */
export function wholePercents(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (!total) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const out = raw.map((r) => Math.floor(r));
  let left = 100 - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out;
}

/** "1 row" / "415 rows". */
export function plural(n: number, one: string, many: string): string {
  return `${formatFull(n)} ${n === 1 ? one : many}`;
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
