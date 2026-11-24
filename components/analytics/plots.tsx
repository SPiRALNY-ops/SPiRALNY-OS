"use client";

/**
 * The two Recharts plots on the page, in their own module so the library
 * (about 100 KB compressed) loads after the first screen is interactive.
 * Recharts draws only in the browser (it measures its width), so nothing is
 * lost from the server-rendered page. Loaded through ./lazy-plots.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { shortDate } from "@/lib/analytics/range";
import type { DailySearchPoint, LeadSource, SourceBucket } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { TooltipBox } from "./chart-parts";
import { SINGLE_SERIES_COLOR, SOURCE_SERIES } from "./series";

export type SourceRow = SourceBucket & { __top: LeadSource | null; __total: number };
export type TrendPoint = DailySearchPoint & { label: string; title: string };
type Row = SourceRow;
type Point = TrendPoint;

/** Stacked segment: 4px rounded top only on the highest visible segment, square at the baseline.
 *  The surface-coloured stroke gives the 2px gap between touching segments. */
function segmentShape(series: LeadSource) {
  return function Segment(props: BarShapeProps) {
    const { x, y, width, height } = props;
    if (!height || height <= 0) return <g />;
    const color = SOURCE_SERIES.find((s) => s.key === series)!.color;
    const top = (props.payload as Row | undefined)?.__top === series;
    const r = top ? Math.min(4, height, width / 2) : 0;
    const d = r
      ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
      : `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
    return <path d={d} style={{ fill: color, stroke: "var(--card)", strokeWidth: 2 }} />;
  };
}

/** Leads or sign-ups per period, stacked by source. */
export function SourcePlot({ rows, noun }: { rows: SourceRow[]; noun: string }) {
  return (
    <BarChart
      responsive
      data={rows}
      style={{ width: "100%", height: 240 }}
      margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
      accessibilityLayer
    >
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={{ stroke: "var(--chart-axis)" }}
        tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
        interval="preserveStartEnd"
        minTickGap={16}
      />
      <YAxis
        allowDecimals={false}
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
        tickFormatter={(v: number) => formatCount(v)}
        width={44}
      />
      <Tooltip
        cursor={{ fill: "var(--muted)", opacity: 0.6 }}
        content={({ active, payload }) => {
          const row = payload?.[0]?.payload as Row | undefined;
          if (!active || !row) return null;
          const range = row.start === row.end ? row.label : `${shortDate(row.start)} – ${shortDate(row.end)}`;
          return (
            <TooltipBox
              title={`${range}: ${formatFull(row.__total)} ${noun}`}
              rows={[...SOURCE_SERIES].reverse().map((s) => ({ label: s.label, value: row[s.key], color: s.color }))}
            />
          );
        }}
      />
      {SOURCE_SERIES.map((s) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} stackId="sources" maxBarSize={24} shape={segmentShape(s.key)} isAnimationActive={false} />
      ))}
    </BarChart>
  );
}

/** One measure of Google search over time (one series, one axis). */
export function TrendPlot({ data, field, label }: { data: TrendPoint[]; field: "clicks" | "impressions"; label: string }) {
  return (
    <AreaChart
      responsive
      data={data}
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
          const p = payload?.[0]?.payload as Point | undefined;
          if (!active || !p) return null;
          return <TooltipBox title={p.title} rows={[{ label, value: p[field], color: SINGLE_SERIES_COLOR }]} />;
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
  );
}
