import { formatFull } from "@/lib/format";

/**
 * A tile's trend: one point per bucket of the range, drawn from zero in the
 * de-emphasis grey, with the latest point marked in the accent (dataviz
 * stat-tile contract). Gaps (null: nothing recorded yet) are left blank, not
 * drawn as zero. The dot is HTML so it stays round while the line stretches.
 */
export function Sparkline({ values, className }: { values: (number | null)[]; className?: string }) {
  const known = values.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
  // One recorded day is a dot, not a trend: leave the space empty until there are two.
  if (values.length < 2 || known.length < 2) return <div className={className} aria-hidden />;
  const nums = known.map(([, v]) => v);
  const max = Math.max(...nums, 1);
  const n = values.length;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  let d = "";
  values.forEach((v, i) => {
    if (v === null) return;
    d += `${i && values[i - 1] !== null ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)} `;
  });
  const [lastIndex, last] = known[known.length - 1];

  return (
    <div
      role="img"
      aria-label={`Trend: lowest ${formatFull(Math.min(...nums))}, highest ${formatFull(Math.max(...nums))}, latest ${formatFull(last)}`}
      className={className}
    >
      <div className="relative h-full w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full overflow-visible">
          <path
            d={d.trim()}
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
          style={{ left: `${x(lastIndex)}%`, top: `${y(last)}%` }}
        />
      </div>
    </div>
  );
}
