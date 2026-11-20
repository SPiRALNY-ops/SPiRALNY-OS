import { formatFull } from "@/lib/format";

/**
 * A tile's trend: one point per bucket of the range, drawn from zero in the
 * de-emphasis grey, with the latest point marked in the accent (dataviz
 * stat-tile contract). The dot is HTML so it stays round while the line stretches.
 */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const n = values.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const last = values[n - 1];

  return (
    <div
      role="img"
      aria-label={`Trend: lowest ${formatFull(Math.min(...values))}, highest ${formatFull(Math.max(...values))}, latest ${formatFull(last)}`}
      className={className}
    >
      <div className="relative h-full w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d={d}
            fill="none"
            stroke="var(--chart-muted)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span
          aria-hidden
          className="absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-card"
          style={{ left: "100%", top: `${y(last)}%` }}
        />
      </div>
    </div>
  );
}
