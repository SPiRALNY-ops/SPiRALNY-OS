import type { Bucket, BucketSize, DateRange, RangeKey } from "./types";

/**
 * Date ranges for the Analytics filter. All dates are New York calendar dates
 * as 'YYYY-MM-DD' strings. Ranges end yesterday, because today is incomplete
 * and Google's data lags (Analytics by hours, Search Console by 2-3 days).
 */
export const RANGES: Record<RangeKey, { label: string; days: number; bucketSize: BucketSize }> = {
  "7d": { label: "Last 7 days", days: 7, bucketSize: "day" },
  "28d": { label: "Last 28 days", days: 28, bucketSize: "day" },
  "90d": { label: "Last 90 days", days: 90, bucketSize: "week" },
  "12m": { label: "Last 12 months", days: 365, bucketSize: "month" },
};
export const RANGE_KEYS = Object.keys(RANGES) as RangeKey[];
export const DEFAULT_RANGE: RangeKey = "28d";

export function parseRangeKey(value: unknown): RangeKey {
  return typeof value === "string" && value in RANGES ? (value as RangeKey) : DEFAULT_RANGE;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

export function addDays(d: string, n: number): string {
  const date = toUtc(d);
  date.setUTCDate(date.getUTCDate() + n);
  return fromUtc(date);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000);
}

/** Today's date in the given time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Monday on or before the date. */
export function weekStart(d: string): string {
  const day = toUtc(d).getUTCDay(); // 0 = Sunday
  return addDays(d, -((day + 6) % 7));
}

export function monthStart(d: string): string {
  return `${d.slice(0, 8)}01`;
}

export function shortDate(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8, 10))}`;
}

function bucketStart(d: string, size: BucketSize, rangeStart: string): string {
  const raw = size === "day" ? d : size === "week" ? weekStart(d) : monthStart(d);
  return raw < rangeStart ? rangeStart : raw;
}

/** Which bucket a date falls in (its key), for grouping rows. */
export function bucketKeyFor(d: string, range: Pick<DateRange, "bucketSize" | "start">): string {
  return bucketStart(d, range.bucketSize, range.start);
}

export function makeBuckets(start: string, end: string, size: BucketSize): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = start;
  while (cursor <= end) {
    const key = bucketStart(cursor, size, start);
    let next: string;
    if (size === "day") next = addDays(cursor, 1);
    else if (size === "week") next = addDays(weekStart(cursor), 7);
    else {
      const date = toUtc(monthStart(cursor));
      date.setUTCMonth(date.getUTCMonth() + 1);
      next = fromUtc(date);
    }
    const bucketEnd = addDays(next, -1) > end ? end : addDays(next, -1);
    const label =
      size === "month" ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}` : shortDate(key);
    buckets.push({ key, start: key, end: bucketEnd, label });
    cursor = next;
  }
  return buckets;
}

export function resolveRange(key: RangeKey, today: string): DateRange {
  const { label, days, bucketSize } = RANGES[key];
  const end = addDays(today, -1);
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  return { key, label, start, end, previousStart, previousEnd, bucketSize, buckets: makeBuckets(start, end, bucketSize) };
}

/** Every date from start to end inclusive. */
export function eachDay(start: string, end: string): string[] {
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}
