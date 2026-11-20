"use client";

import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/analytics/range";
import type { LeadSource, SourceBucket } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { ChartCard, Legend, TooltipBox } from "./chart-parts";
import { SOURCE_SERIES } from "./series";

type Row = SourceBucket & { __top: LeadSource | null; __total: number };

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

export function SourceChart({
  title,
  description,
  buckets,
  sample,
  noun,
}: {
  title: string;
  description: string;
  buckets: SourceBucket[];
  sample: boolean;
  noun: string;
}) {
  const rows: Row[] = buckets.map((b) => {
    const visible = SOURCE_SERIES.filter((s) => b[s.key] > 0);
    return {
      ...b,
      __top: visible.at(-1)?.key ?? null,
      __total: SOURCE_SERIES.reduce((sum, s) => sum + b[s.key], 0),
    };
  });
  const totals = SOURCE_SERIES.map((s) => ({ ...s, total: rows.reduce((sum, r) => sum + r[s.key], 0) }));
  const grand = totals.reduce((s, t) => s + t.total, 0);

  const chart = (
    <div>
      <div className="mb-3">
        <Legend items={totals} />
      </div>
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
                title={`${range} · ${formatFull(row.__total)} ${noun}`}
                rows={[...SOURCE_SERIES].reverse().map((s) => ({ label: s.label, value: row[s.key], color: s.color }))}
              />
            );
          }}
        />
        {SOURCE_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="sources" maxBarSize={24} shape={segmentShape(s.key)} isAnimationActive={false} />
        ))}
      </BarChart>
    </div>
  );

  const table = (
    <div className="max-h-[300px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            {SOURCE_SERIES.map((s) => (
              <TableHead key={s.key} className="text-right">
                {s.label}
              </TableHead>
            ))}
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.label}</TableCell>
              {SOURCE_SERIES.map((s) => (
                <TableCell key={s.key} className="tabular text-right">
                  {formatFull(r[s.key])}
                </TableCell>
              ))}
              <TableCell className="tabular text-right font-medium">{formatFull(r.__total)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <ChartCard
      title={title}
      description={
        <>
          {description} <span className="font-medium text-foreground">{formatFull(grand)} in total.</span>
        </>
      }
      sample={sample}
      chart={chart}
      table={table}
    />
  );
}
