"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SourceBucket } from "@/lib/analytics/types";
import { formatFull } from "@/lib/format";
import { ChartCard, Legend } from "./chart-parts";
import { SourcePlot } from "./lazy-plots";
import type { SourceRow } from "./plots";
import { SOURCE_SERIES } from "./series";

type Row = SourceRow;

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
      <SourcePlot rows={rows} noun={noun} />
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
