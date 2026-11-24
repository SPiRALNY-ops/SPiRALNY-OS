"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEdgeFade } from "./scroll-row";

export type SortState<K extends string> = { key: K; dir: "asc" | "desc" };

/** Sorts rows by a numeric or text column; numbers start high-to-low, text A–Z. */
export function useSort<T, K extends string>(rows: T[], initial: SortState<K>, value: (row: T, key: K) => number | string | null) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = value(a, sort.key);
      const y = value(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1; // missing values always last
      if (y === null) return -1;
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
    });
  }, [rows, sort, value]);
  const toggle = (key: K, numeric = true) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: numeric ? "desc" : "asc" }));
  return { sorted, sort, toggle, setSort };
}

/**
 * Phones sort a list with one picker (column headers do it on wider screens).
 * Numbers sort high to low, text A to Z.
 */
export function SortSelect<K extends string>({
  options,
  sort,
  onChange,
}: {
  options: { key: K; label: string; numeric?: boolean }[];
  sort: SortState<K>;
  onChange: (next: SortState<K>) => void;
}) {
  return (
    <label className="relative inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      Sort by
      <select
        value={sort.key}
        onChange={(e) => {
          const o = options.find((x) => x.key === e.target.value)!;
          onChange({ key: o.key, dir: o.numeric === false ? "asc" : "desc" });
        }}
        className="appearance-none rounded-full border bg-card py-1.5 pr-7 pl-3 text-xs font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 size-3.5 text-muted-foreground" />
    </label>
  );
}

/** A figure with its unit, for the right side of a phone list row: "84 clicks". */
export function RowFigure({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <span className="shrink-0 text-right text-sm whitespace-nowrap tabular">
      <span className="font-semibold">{value}</span>
      {unit && <span className="text-muted-foreground"> {unit}</span>}
    </span>
  );
}

/** A one-hue bar from zero (dataviz: one baseline), with its printed figure beside it. */
export function InlineBar({ ratio, label, labelWidth = "w-11" }: { ratio: number; label: React.ReactNode; labelWidth?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div aria-hidden className="h-2 flex-1 rounded-full bg-muted">
        <div className="h-2 rounded-full bg-chart-slate" style={{ width: `${Math.min(100, Math.max(ratio * 100, ratio > 0 ? 1.5 : 0))}%` }} />
      </div>
      <span className={cn("shrink-0 text-right text-xs tabular", labelWidth)}>{label}</span>
    </div>
  );
}

/** A column header that sorts its table, announcing the current order to screen readers. */
export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  numeric = true,
  align = "right",
}: {
  label: React.ReactNode;
  column: K;
  sort: SortState<K>;
  onSort: (key: K, numeric?: boolean) => void;
  numeric?: boolean;
  align?: "left" | "right";
}) {
  const active = sort.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onSort(column, numeric)}
      className={cn(
        "-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 whitespace-nowrap transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        align === "right" && "flex-row-reverse",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      {label}
      <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      <span className="sr-only">{active ? (sort.dir === "asc" ? ", sorted low to high" : ", sorted high to low") : ", sort"}</span>
    </button>
  );
}

export function ariaSort<K extends string>(sort: SortState<K>, column: K): "ascending" | "descending" | "none" {
  return sort.key === column ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
}

/** One-row filter chips (pill-shaped, like the date range). */
export function FilterChips<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  const [ref, fadeClass] = useEdgeFade<HTMLDivElement>();
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cn("no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5", fadeClass)}>
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.key)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
              selected ? "border-primary bg-primary font-semibold text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
            {/* Unselected counts keep the label's full muted colour: any fade drops them under 4.5:1. */}
            {o.count !== undefined && <span className={cn("ml-1.5 tabular", selected && "opacity-80")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** "Show all N" / "Show fewer" under a long list. */
export function ShowMore({ shown, total, expanded, onToggle }: { shown: number; total: number; expanded: boolean; onToggle: () => void }) {
  if (total <= shown && !expanded) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 rounded-full border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
    >
      {expanded ? "Show fewer" : `Show all ${total}`}
    </button>
  );
}
