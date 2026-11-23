"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return { sorted, sort, toggle };
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
  return (
    <div role="radiogroup" aria-label={label} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
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
            {o.count !== undefined && <span className={cn("ml-1.5 tabular", selected ? "opacity-80" : "opacity-70")}>{o.count}</span>}
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
