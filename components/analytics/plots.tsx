"use client";

/**
 * The two Recharts plots on the page, in their own module so the library
 * (about 100 KB compressed) loads after the first screen is interactive.
 * Recharts draws only in the browser (it measures its width), so nothing is
 * lost from the server-rendered page. Loaded through ./lazy-plots.
 */
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { shortDate } from "@/lib/analytics/range";
import type { DailySearchPoint, LeadSource, SourceBucket } from "@/lib/analytics/types";
import { formatCount, formatFull, formatPercent } from "@/lib/format";
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

/** A month (or week) row for the plots below; `partial` = not over yet, drawn lighter and said so. */
export type StackSeries = { key: string; label: string; color: string };
export type StackRow = { key: string; label: string; title: string; partial: boolean; __top: string | null; __total: number } & Record<string, number | string | boolean | null>;

function roundedTop(x: number, y: number, width: number, height: number, round: boolean) {
  const r = round ? Math.min(4, height, width / 2) : 0;
  return r
    ? `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`
    : `M${x},${y + height} L${x},${y} L${x + width},${y} L${x + width},${y + height} Z`;
}

/** Stacked bars in fixed series order (search groups, plans): 4px round on the top segment, 2px surface gaps. */
export function StackPlot({ rows, series, noun, height = 240 }: { rows: StackRow[]; series: StackSeries[]; noun: string; height?: number }) {
  const shape = (s: StackSeries) =>
    function Segment(props: BarShapeProps) {
      const { x, y, width, height: h } = props;
      if (!h || h <= 0) return <g />;
      const row = props.payload as StackRow | undefined;
      return (
        <path
          d={roundedTop(x, y, width, h, row?.__top === s.key)}
          style={{ fill: s.color, stroke: "var(--card)", strokeWidth: 2, opacity: row?.partial ? 0.55 : 1 }}
        />
      );
    };
  return (
    <BarChart responsive data={rows} style={{ width: "100%", height }} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} tickFormatter={(v: number) => formatCount(v)} width={44} />
      <Tooltip
        cursor={{ fill: "var(--muted)", opacity: 0.6 }}
        content={({ active, payload }) => {
          const row = payload?.[0]?.payload as StackRow | undefined;
          if (!active || !row) return null;
          return (
            <TooltipBox
              title={`${row.title}: ${formatFull(row.__total)} ${noun}`}
              rows={[...series].reverse().map((s) => ({ label: s.label, value: Number(row[s.key] ?? 0), color: s.color }))}
            />
          );
        }}
      />
      {series.map((s) => (
        <Bar key={s.key} dataKey={s.key} name={s.label} stackId="stack" maxBarSize={28} shape={shape(s)} isAnimationActive={false} />
      ))}
    </BarChart>
  );
}

export type BarRow = { key: string; label: string; title: string; value: number; partial: boolean };

/** One measure by month or week (one series, one axis). */
export function BarsPlot({ rows, label, height = 200 }: { rows: BarRow[]; label: string; height?: number }) {
  function Column(props: BarShapeProps) {
    const { x, y, width, height: h } = props;
    if (!h || h <= 0) return <g />;
    const row = props.payload as BarRow | undefined;
    return <path d={roundedTop(x, y, width, h, true)} style={{ fill: SINGLE_SERIES_COLOR, opacity: row?.partial ? 0.55 : 1 }} />;
  }
  return (
    <BarChart responsive data={rows} style={{ width: "100%", height }} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} tickFormatter={(v: number) => formatCount(v)} width={44} />
      <Tooltip
        cursor={{ fill: "var(--muted)", opacity: 0.6 }}
        content={({ active, payload }) => {
          const row = payload?.[0]?.payload as BarRow | undefined;
          if (!active || !row) return null;
          return <TooltipBox title={row.title} rows={[{ label, value: row.value, color: SINGLE_SERIES_COLOR }]} />;
        }}
      />
      <Bar dataKey="value" name={label} maxBarSize={28} shape={Column} isAnimationActive={false} />
    </BarChart>
  );
}

export type RateRow = { key: string; label: string; title: string; rate: number | null; partial: boolean; note: string };

/** A rate over time (one series, one axis, in percent). Gaps where there's nothing to divide by. */
export function RatePlot({ rows, label, height = 200 }: { rows: RateRow[]; label: string; height?: number }) {
  return (
    <LineChart responsive data={rows} style={{ width: "100%", height }} margin={{ top: 8, right: 8, bottom: 0, left: -4 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--chart-axis)" }} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} interval="preserveStartEnd" minTickGap={12} />
      <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--chart-muted)", fontSize: 12 }} tickFormatter={(v: number) => formatPercent(v, 1)} width={52} />
      <Tooltip
        cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
        content={({ active, payload }) => {
          const row = payload?.[0]?.payload as RateRow | undefined;
          if (!active || !row || row.rate === null) return null;
          return (
            <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
              <p className="mb-1 text-xs text-muted-foreground">{row.title}</p>
              <p className="flex items-center gap-2 text-sm">
                <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: SINGLE_SERIES_COLOR }} />
                <span className="tabular font-semibold">{formatPercent(row.rate, 2)}</span>
                <span className="text-muted-foreground">{label}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
            </div>
          );
        }}
      />
      <Line
        type="monotone"
        dataKey="rate"
        stroke={SINGLE_SERIES_COLOR}
        strokeWidth={2}
        connectNulls={false}
        isAnimationActive={false}
        dot={(props: { cx?: number; cy?: number; payload?: RateRow; index?: number }) => {
          const { cx, cy, payload, index } = props;
          if (cx === undefined || cy === undefined || !payload || payload.rate === null) return <g key={index} />;
          // A period that isn't over yet is drawn hollow.
          return (
            <circle
              key={index}
              cx={cx}
              cy={cy}
              r={4}
              fill={payload.partial ? "var(--card)" : SINGLE_SERIES_COLOR}
              stroke={SINGLE_SERIES_COLOR}
              strokeWidth={2}
            />
          );
        }}
        activeDot={{ r: 5, fill: SINGLE_SERIES_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
      />
    </LineChart>
  );
}
