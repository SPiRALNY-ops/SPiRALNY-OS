import type { Ranked } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Ranked (or ordered) horizontal bars in one hue: a name, its figure and share,
 * and a bar under the name, all bars on one baseline (dataviz: part-to-whole,
 * compare the parts). Every figure is printed, so the list is its own table.
 */
export function BarList({
  items,
  label,
  total,
  emptyText = "Nothing recorded in this period.",
  valueSuffix,
  className,
}: {
  items: Ranked[];
  /** Accessible name for the list. */
  label: string;
  /** What shares are of; defaults to the sum of the items. */
  total?: number;
  emptyText?: string;
  /** e.g. ["visit", "visits"] */
  valueSuffix?: [string, string];
  className?: string;
}) {
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  const max = Math.max(...items.map((i) => i.value), 0);
  if (!items.length || sum === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul aria-label={label} className={cn("flex flex-col gap-3.5", className)}>
      {items.map((item) => {
        const share = sum ? item.value / sum : 0;
        return (
          <li key={item.key} className="min-w-0">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 tabular">
                <span className="font-semibold">{formatFull(item.value)}</span>
                {valueSuffix && <span className="text-muted-foreground"> {item.value === 1 ? valueSuffix[0] : valueSuffix[1]}</span>}
                <span className="ml-2 inline-block w-11 text-right text-muted-foreground">{formatPercent(share, 0)}</span>
              </span>
            </div>
            <div aria-hidden className="mt-1.5 h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-chart-slate"
                style={{ width: max ? `${Math.max((item.value / max) * 100, item.value ? 1.5 : 0)}%` : 0 }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
