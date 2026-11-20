import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Kpi, KpiKey } from "@/lib/analytics/types";
import { formatCount, formatFull, formatPercent, percentChange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";

/** Whether a rise is good news. Unfinished forms can rise just because more people start, so it's neutral. */
const UP_IS_GOOD: Record<KpiKey, boolean | null> = {
  leads: true,
  signups: true,
  unfinished: null,
  visits: true,
  googleClicks: true,
  replies: true,
};

function Delta({ kpi, periodLabel }: { kpi: Kpi; periodLabel: string }) {
  const change = percentChange(kpi.value, kpi.previous);
  if (change === null) {
    return <p className="text-xs text-muted-foreground">None in the previous {periodLabel}</p>;
  }
  const direction = change > 0.005 ? "up" : change < -0.005 ? "down" : "flat";
  const good = UP_IS_GOOD[kpi.key];
  const tone =
    direction === "flat" || good === null
      ? "text-muted-foreground"
      : (direction === "up") === good
        ? "text-good"
        : "text-bad";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  return (
    <p className="flex flex-wrap items-center gap-x-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-medium", tone)}>
        <Icon aria-hidden className="size-3.5" />
        {direction === "flat" ? "No change" : `${change > 0 ? "+" : ""}${formatPercent(change, 0)}`}
      </span>
      <span className="text-muted-foreground">
        vs {formatFull(kpi.previous)} in the previous {periodLabel}
      </span>
    </p>
  );
}

export function KpiTiles({ kpis, periodLabel }: { kpis: Kpi[]; periodLabel: string }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((kpi) => (
        <div key={kpi.key} className="flex min-w-0 flex-col gap-1.5 rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-muted-foreground">{kpi.label}</p>
          </div>
          <p className="text-2xl font-semibold tracking-tight sm:text-3xl" title={formatFull(kpi.value)}>
            {formatCount(kpi.value)}
          </p>
          <Delta kpi={kpi} periodLabel={periodLabel} />
          {kpi.origin === "sample" && <SampleBadge className="mt-auto self-start" />}
        </div>
      ))}
    </div>
  );
}
