"use client";

import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFull } from "@/lib/format";

/** Tooltip in the dataviz style: values lead, series names follow, keyed by a short line. */
export function TooltipBox({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color?: string }[];
}) {
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="mb-1.5 text-xs text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2 text-sm">
            {r.color && <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: r.color }} />}
            <span className="tabular font-semibold">{formatFull(r.value)}</span>
            <span className="text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Legend for two or more series: swatch + name + total. Text stays in text colours. */
export function Legend({ items }: { items: { label: string; color: string; total?: number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          <span className="text-muted-foreground">{i.label}</span>
          {i.total !== undefined && <span className="tabular font-medium">{formatFull(i.total)}</span>}
        </li>
      ))}
    </ul>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-dashed border-brand/60 bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-foreground",
        className,
      )}
      title="Made-up numbers, shown until this source is connected"
    >
      Sample data
    </span>
  );
}

/** Card holding a chart with its table twin (the accessible view of the same numbers). */
export function ChartCard({
  title,
  description,
  sample,
  footer,
  chart,
  table,
}: {
  title: string;
  description?: React.ReactNode;
  sample: boolean;
  footer?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{title}</h3>
            {sample && <SampleBadge />}
          </div>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div role="group" aria-label={`${title}: view`} className="flex shrink-0 rounded-full border p-0.5">
          {(
            [
              ["chart", ChartColumn, "Chart"],
              ["table", Table2, "Table"],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              aria-label={`Show ${label.toLowerCase()}`}
              title={label}
              onClick={() => setView(key)}
              className={cn(
                "rounded-full p-1.5 text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                view === key ? "bg-primary text-primary-foreground" : "hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
            </button>
          ))}
        </div>
      </header>
      <div className="min-w-0 flex-1">{view === "chart" ? chart : table}</div>
      {footer && <footer className="mt-3 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  );
}
