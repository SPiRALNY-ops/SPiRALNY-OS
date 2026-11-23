import type { Kpi, KpiKey } from "@/lib/analytics/types";
import { formatCount, formatFull } from "@/lib/format";
import { SampleBadge } from "./chart-parts";
import { InfoTip } from "./info-tip";
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

/** Change against the previous period, coloured by whether the move is good news. */
export function Delta({ kpi, inverse = false, suffix }: { kpi: Kpi; inverse?: boolean; suffix?: string }) {
  const good = UP_IS_GOOD[kpi.key];
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
        <dl className="grid grid-cols-2 gap-px lg:grid-cols-5">
          {kpis.map((kpi) => (
            <div key={kpi.key} className="flex min-w-0 flex-col bg-card p-4 max-lg:last:odd:col-span-2 sm:p-5">
              <dt className="text-sm font-medium text-muted-foreground">
                {kpi.label} <InfoTip label={kpi.label}>{KPI_INFO[kpi.key]}</InfoTip>
              </dt>
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
