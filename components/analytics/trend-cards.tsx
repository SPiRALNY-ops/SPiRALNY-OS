"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { soFar } from "@/lib/analytics/range";
import type { MonthPoint } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartCard, Legend } from "./chart-parts";
import { BarsPlot, RatePlot, StackPlot } from "./lazy-plots";
import type { StackRow } from "./plots";


/** Small segmented switch above a chart (one row of filters, per the chart rules). */
function Switch<K extends string>({ options, value, onChange, label }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          onClick={() => onChange(o.key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring",
            o.key === value ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Months stacked by series in a fixed order (search groups, plans), with its table twin. */
export function StackCard({
  id,
  title,
  description,
  footer,
  months,
  series,
  noun,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  months: MonthPoint[];
  series: { key: string; label: string; color: string; values: number[] }[];
  noun: string;
}) {
  const rows: StackRow[] = months.map((m, i) => {
    const visible = series.filter((s) => (s.values[i] ?? 0) > 0);
    const row: StackRow = { key: m.key, label: m.label, title: `${m.label}${soFar(m)}`, partial: m.partial, __top: visible.at(-1)?.key ?? null, __total: 0 };
    for (const s of series) {
      row[s.key] = s.values[i] ?? 0;
      row.__total += s.values[i] ?? 0;
    }
    return row;
  });
  const totals = series.map((s) => ({ label: s.label, color: s.color, total: s.values.reduce((a, b) => a + b, 0) }));
  return (
    <div id={id} className="scroll-mt-32 lg:scroll-mt-20">
      <ChartCard
        title={title}
        description={description}
        sample={false}
        footer={footer}
        chart={
          <div>
            <div className="mb-3">
              <Legend items={totals} />
            </div>
            <StackPlot rows={rows} series={series} noun={noun} />
          </div>
        }
        table={
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {series.map((s) => (
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
                    <TableCell className="whitespace-nowrap">{r.title}</TableCell>
                    {series.map((s) => (
                      <TableCell key={s.key} className="tabular text-right">
                        {formatFull(Number(r[s.key] ?? 0))}
                      </TableCell>
                    ))}
                    <TableCell className="tabular text-right font-medium">{formatFull(r.__total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
      />
    </div>
  );
}

/** One measure by month, with a switch between measures that share the months (never two axes). */
export function MonthlyBarsCard({
  id,
  title,
  description,
  footer,
  months,
  measures,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  months: MonthPoint[];
  measures: { key: string; label: string; values: number[] }[];
}) {
  const [key, setKey] = useState(measures[0].key);
  const measure = measures.find((m) => m.key === key) ?? measures[0];
  const rows = months.map((m, i) => ({ key: m.key, label: m.label, title: `${m.label}${soFar(m)}`, value: measure.values[i] ?? 0, partial: m.partial }));
  return (
    <div id={id} className="scroll-mt-32 lg:scroll-mt-20">
      <ChartCard
        title={title}
        description={description}
        sample={false}
        footer={footer}
        chart={
          <div>
            {measures.length > 1 && (
              <div className="mb-3">
                <Switch label={`${title}: measure`} options={measures.map((m) => ({ key: m.key, label: m.label }))} value={key} onChange={setKey} />
              </div>
            )}
            <BarsPlot rows={rows} label={measure.label} />
          </div>
        }
        table={
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {measures.map((m) => (
                    <TableHead key={m.key} className="text-right">
                      {m.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((m, i) => (
                  <TableRow key={m.key}>
                    <TableCell className="whitespace-nowrap">
                      {m.label}
                      {soFar(m)}
                    </TableCell>
                    {measures.map((ms) => (
                      <TableCell key={ms.key} className="tabular text-right">
                        {formatFull(ms.values[i] ?? 0)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
      />
    </div>
  );
}

type RatePeriod = { key: string; label: string; sent: number; replies: number; partial: boolean; starts?: string };

/** Replies for each email sent, by week or by month. */
export function ReplyRateCard({
  id,
  title,
  description,
  footer,
  weeks,
  months,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  weeks: RatePeriod[];
  months: RatePeriod[];
}) {
  const [by, setBy] = useState<"months" | "weeks">("months");
  const periods = by === "months" ? months : weeks;
  const rows = periods.map((p) => ({
    key: p.key,
    label: p.label,
    title: `${by === "weeks" ? `Week of ${p.label}` : p.label}${soFar(p)}`,
    rate: p.sent ? p.replies / p.sent : null,
    partial: p.partial,
    note: p.sent ? `${formatFull(p.replies)} replies from ${formatFull(p.sent)} emails` : "No emails sent",
  }));
  return (
    <div id={id} className="scroll-mt-32 lg:scroll-mt-20">
      <ChartCard
        title={title}
        description={description}
        sample={false}
        footer={footer}
        chart={
          <div>
            <div className="mb-3">
              <Switch
                label={`${title}: period`}
                options={[
                  { key: "months", label: "By month" },
                  { key: "weeks", label: "By week" },
                ]}
                value={by}
                onChange={setBy}
              />
            </div>
            <RatePlot rows={rows} label="reply rate" />
          </div>
        }
        table={
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{by === "weeks" ? "Week of" : "Month"}</TableHead>
                  <TableHead className="text-right">Emails sent</TableHead>
                  <TableHead className="text-right">Replies</TableHead>
                  <TableHead className="text-right">Reply rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell className="whitespace-nowrap">
                      {p.label}
                      {soFar(p)}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatFull(p.sent)}</TableCell>
                    <TableCell className="tabular text-right">{formatFull(p.replies)}</TableCell>
                    <TableCell className="tabular text-right">{p.sent ? formatPercent(p.replies / p.sent, 2) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        }
      />
    </div>
  );
}
