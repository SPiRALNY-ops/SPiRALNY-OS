"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/analytics/range";
import type { Bucket, BucketSize, DailySearchPoint } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { ChartCard } from "./chart-parts";
import { TrendPlot } from "./lazy-plots";
import type { TrendPoint } from "./plots";

type Point = TrendPoint;

/** One series per chart (never two y-axes): clicks and times shown sit side by side. */
function MiniTrend({ data, field, label }: { data: Point[]; field: "clicks" | "impressions"; label: string }) {
  const total = data.reduce((s, d) => s + d[field], 0);
  const last = data.at(-1);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold">{formatCount(total)}</span>
      </figcaption>
      <TrendPlot data={data} field={field} label={label} />
      {last && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {last.title}: <span className="tabular font-medium text-foreground">{formatFull(last[field])}</span>
        </p>
      )}
    </figure>
  );
}

const fullDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Days added up into the range's own buckets (weeks for 90 days, months for 12), so long ranges stay readable. */
function toPoints(daily: DailySearchPoint[], buckets: Bucket[], size: BucketSize): Point[] {
  if (size === "day") return daily.map((d) => ({ ...d, label: shortDate(d.day), title: fullDate(d.day) }));
  const lastDay = daily.at(-1)?.day;
  const points: Point[] = [];
  for (const b of buckets) {
    if (lastDay && b.start > lastDay) break; // not reported yet
    const days = daily.filter((d) => d.day >= b.start && d.day <= b.end);
    const partial = Boolean(lastDay && lastDay < b.end);
    // The period rarely starts on the 1st (or a Monday), so its first bucket can be short.
    const startsLate = size === "month" ? b.start.slice(8) !== "01" : new Date(`${b.start}T12:00:00Z`).getUTCDay() !== 1;
    const note = startsLate ? ` (from ${fullDate(b.start)})` : partial ? " (so far)" : "";
    const title =
      size === "week"
        ? `Week of ${fullDate(b.start)}${partial ? " (so far)" : ""}`
        : `${MONTH_LONG[Number(b.start.slice(5, 7)) - 1]} ${b.start.slice(0, 4)}${note}`;
    points.push({
      day: b.start,
      label: b.label,
      title,
      clicks: days.reduce((s, d) => s + d.clicks, 0),
      impressions: days.reduce((s, d) => s + d.impressions, 0),
    });
  }
  return points;
}

export function SearchTrend({
  daily: days,
  sample,
  rangeEnd,
  buckets,
  bucketSize,
}: {
  daily: DailySearchPoint[];
  sample: boolean;
  rangeEnd?: string;
  buckets: Bucket[];
  bucketSize: BucketSize;
}) {
  const daily = toPoints(days, buckets, bucketSize);
  const lastReported = days.at(-1)?.day;
  const chart = (
    <div className="grid gap-6 sm:grid-cols-2">
      <MiniTrend data={daily} field="clicks" label="Clicks from Google" />
      <MiniTrend data={daily} field="impressions" label="Times shown in Google" />
    </div>
  );
  const table = (
    <div className="max-h-[260px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{bucketSize === "day" ? "Day" : bucketSize === "week" ? "Week" : "Month"}</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Times shown</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...daily].reverse().map((d) => (
            <TableRow key={d.day}>
              <TableCell>{d.title}</TableCell>
              <TableCell className="tabular text-right">{formatFull(d.clicks)}</TableCell>
              <TableCell className="tabular text-right">{formatFull(d.impressions)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
  return (
    <ChartCard
      title={bucketSize === "day" ? "Day by day" : bucketSize === "week" ? "Week by week" : "Month by month"}
      description={`Clicks and times shown for each ${bucketSize} of the period.`}
      sample={sample}
      chart={chart}
      table={table}
      footer={
        [
          bucketSize === "month" && buckets[0] && buckets[0].start.slice(8) !== "01"
            ? `The first month only counts from ${fullDate(buckets[0].start)}, when this period starts.`
            : "",
          !sample && rangeEnd && lastReported && lastReported < rangeEnd
            ? `Search Console reports 2 to 3 days late, so this stops at ${fullDate(lastReported)}, the last day it has reported.`
            : "Search Console reports 2 to 3 days late, so the most recent days can still rise.",
        ]
          .filter(Boolean)
          .join(" ")
      }
    />
  );
}
