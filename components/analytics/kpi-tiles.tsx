import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Kpi, KpiKey } from "@/lib/analytics/types";
import { formatCount, formatFull, formatPercent, percentChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";
import { Sparkline } from "./sparkline";

/** Whether a rise is good news. Unfinished forms can rise just because more people start, so it's neutral. */
const UP_IS_GOOD: Record<KpiKey, boolean | null> = {
  leads: true,
  signups: true,
  unfinished: null,
  visits: true,
  googleClicks: true,
  replies: true,
};

/**
 * Change against the previous period. `inverse` = on the charcoal band, where
 * the light-surface green/red would be unreadable.
 */
export function Delta({ kpi, inverse = false, suffix }: { kpi: Kpi; inverse?: boolean; suffix?: string }) {
  const change = percentChange(kpi.value, kpi.previous);
  const muted = inverse ? "text-sidebar-muted" : "text-muted-foreground";
  if (change === null) return <p className={cn("text-xs", muted)}>None in the period before</p>;
  const direction = change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";
  const good = UP_IS_GOOD[kpi.key];
  const tone =
    direction === "flat" || good === null
      ? muted
      : (direction === "up") === good
        ? inverse ? "text-good-inverse" : "text-good"
        : inverse ? "text-bad-inverse" : "text-bad";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
        {direction === "flat" ? "No change" : `${change > 0 ? "+" : ""}${formatPercent(change, 0)}`}
      </span>
      <span className={muted}>
        vs {formatFull(kpi.previous)}
        {suffix}
      </span>
    </p>
  );
}

/**
 * The supporting numbers, in one panel split by hairlines (not a row of
 * separate cards). One "Sample data" label for the strip when every number is a
 * sample; when real and sample sit side by side, each sample number carries its own.
 */
export function KpiStrip({ kpis, periodLabel }: { kpis: Kpi[]; periodLabel: string }) {
  const allSample = kpis.every((k) => k.origin === "sample");
  return (
    <section aria-labelledby="kpi-caption" className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="kpi-caption" className="text-sm text-muted-foreground">
          Last {periodLabel}, compared with the {periodLabel} before
        </h2>
        {allSample && <SampleBadge />}
      </div>
      <div className="overflow-hidden rounded-xl border bg-border shadow-xs">
        <dl className="grid grid-cols-2 gap-px lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="flex min-w-0 flex-col bg-card p-4 max-lg:last:odd:col-span-2 sm:p-5">
              <dt className="text-sm font-medium text-muted-foreground">{kpi.label}</dt>
              <dd className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight" title={formatFull(kpi.value)}>
                {formatCount(kpi.value)}
              </dd>
              <dd className="mt-1">
                <Delta kpi={kpi} />
              </dd>
              <dd className="mt-4">
                <Sparkline values={kpi.trend} className="h-8 w-full pr-1" />
              </dd>
              {!allSample && kpi.origin === "sample" && (
                <dd className="mt-3">
                  <SampleBadge />
                </dd>
              )}
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
