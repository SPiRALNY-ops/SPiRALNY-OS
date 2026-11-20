"use client";

import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/analytics/range";
import type { DailySearchPoint } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { ChartCard, TooltipBox } from "./chart-parts";
import { SINGLE_SERIES_COLOR } from "./series";

/** One series per chart (never two y-axes): clicks and times shown sit side by side. */
function MiniTrend({ data, field, label }: { data: DailySearchPoint[]; field: "clicks" | "impressions"; label: string }) {
  const total = data.reduce((s, d) => s + d[field], 0);
  const last = data.at(-1);
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold">{formatCount(total)}</span>
      </figcaption>
      <AreaChart
        responsive
        data={data.map((d) => ({ ...d, label: shortDate(d.day) }))}
        style={{ width: "100%", height: 180 }}
        margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        accessibilityLayer
      >
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--chart-axis)" }}
          tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--chart-muted)", fontSize: 11 }}
          tickFormatter={(v: number) => formatCount(v)}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (DailySearchPoint & { label: string }) | undefined;
            if (!active || !p) return null;
            return <TooltipBox title={p.label} rows={[{ label, value: p[field], color: SINGLE_SERIES_COLOR }]} />;
          }}
        />
        <Area
          type="monotone"
          dataKey={field}
          stroke={SINGLE_SERIES_COLOR}
          strokeWidth={2}
          fill={SINGLE_SERIES_COLOR}
          fillOpacity={0.1}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 4, fill: SINGLE_SERIES_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
        />
      </AreaChart>
      {last && (
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {shortDate(last.day)}: <span className="tabular font-medium text-foreground">{formatFull(last[field])}</span>
        </p>
      )}
    </figure>
  );
}

export function SearchTrend({ daily, sample }: { daily: DailySearchPoint[]; sample: boolean }) {
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
            <TableHead>Day</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Times shown</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...daily].reverse().map((d) => (
            <TableRow key={d.day}>
              <TableCell>{shortDate(d.day)}</TableCell>
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
      title="Google search"
      description="How often spiralny.com appeared in Google results and was clicked."
      sample={sample}
      chart={chart}
      table={table}
      footer="Search Console reports with a 2 to 3 day delay, so the last days can look low."
    />
  );
}
