import type { Kpi, KpiKey } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";
import { TipLabel } from "./info-tip";
import { Sparkline } from "./sparkline";
import { Change } from "./stat";

/** Whether a rise is good news. Unfinished forms can rise just because more people start, so it's neutral. */
const UP_IS_GOOD: Record<KpiKey, boolean | null> = {
  leads: true,
  signups: true,
  unfinished: null,
  visits: true,
  googleClicks: true,
  replies: true,
};

/** What each number means, in plain words (shown behind the "?"). */
export const KPI_INFO: Record<KpiKey, string> = {
  leads: "People who started a sign-up form or were added to the lead sheet, each counted once.",
  signups: "People who completed a sign-up form or were added to the lead sheet's SIGNED! tab.",
  unfinished: "People who started a sign-up form but never finished one (WPForms' abandoned entries).",
  visits: "Visits to spiralny.com recorded by Google Analytics (sessions).",
  googleClicks: "Clicks on spiralny.com in Google search results, from Search Console.",
  replies: "People who replied to a cold email in Instantly, each counted once. Out-of-office replies are left out.",
};

/** "2026-11-20" -> "Nov 20" (the date is a New York calendar day, so it is read as UTC noon). */
function shortDate(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Change against the previous period, coloured by whether the move is good news. */
export function Delta({ kpi, inverse = false, suffix }: { kpi: Kpi; inverse?: boolean; suffix?: string }) {
  const good = UP_IS_GOOD[kpi.key];
  // The source only started recording inside this period: the figure counts from that day, with nothing before it.
  if (kpi.previous === null && kpi.since) {
    return <p className={cn("text-xs", inverse ? "text-sidebar-muted" : "text-muted-foreground")}>Counted since {shortDate(kpi.since)}</p>;
  }
  return (
    <Change
      value={kpi.value}
      previous={kpi.previous}
      goodWhen={good === null ? null : good ? "up" : "down"}
      inverse={inverse}
      previousText={kpi.previous === null ? undefined : `vs ${formatFull(kpi.previous)}${suffix ?? ""}`}
    />
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
        {/* Phones: one row per number (label and change, trend, figure), like a watch list.
            Wider: tiles split by hairlines. The DOM order is the tile order; the grid places the row. */}
        <dl className="grid grid-cols-1 gap-px sm:grid-cols-2 xl:grid-cols-5">
          {kpis.map((kpi) => (
            <div
              key={kpi.key}
              className="grid min-w-0 grid-cols-[minmax(0,1fr)_4.5rem_minmax(3.25rem,auto)] items-center gap-x-3 gap-y-0.5 bg-card px-4 py-3.5 sm:flex sm:flex-col sm:items-stretch sm:gap-0 sm:p-5 sm:max-xl:last:odd:col-span-2"
            >
              <dt className="col-start-1 row-start-1 text-sm font-medium text-muted-foreground">
                <TipLabel label={kpi.label} info={KPI_INFO[kpi.key]} />
              </dt>
              <dd
                className="col-start-3 row-span-2 row-start-1 text-right text-2xl leading-tight font-semibold tracking-tight sm:mt-1 sm:text-left sm:text-[1.75rem]"
                title={formatFull(kpi.value)}
              >
                {formatCount(kpi.value)}
              </dd>
              <dd className="col-start-1 row-start-2 sm:mt-1">
                <Delta kpi={kpi} />
              </dd>
              <dd className="col-start-2 row-span-2 row-start-1 sm:mt-4">
                <Sparkline values={kpi.trend} className="h-8 w-full sm:pr-1" />
              </dd>
              {!allSample && kpi.origin === "sample" && (
                <dd className="col-span-3 row-start-3 mt-2 sm:mt-3">
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
