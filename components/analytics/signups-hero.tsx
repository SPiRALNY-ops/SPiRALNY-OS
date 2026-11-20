import type { Kpi, SourceBucket } from "@/lib/analytics/types";
import { formatFull } from "@/lib/format";
import { SampleBadge } from "./chart-parts";
import { Delta } from "./kpi-tiles";
import { SOURCE_SERIES } from "./series";

type Part = { key: string; label: string; color: string; n: number; share: number };

/** One plain sentence answering "where did sign-ups come from?". */
function insight(parts: Part[], total: number, periodLabel: string): string {
  if (total === 0) return `No completed sign-ups in the last ${periodLabel} yet.`;
  const ranked = [...parts].sort((a, b) => b.n - a.n);
  const [top, next] = ranked;
  if (top.key === "unknown") return "Most of them can't be traced to a source yet.";
  if (next && next.n === top.n && next.key !== "unknown") {
    return `${top.label} and ${next.label.toLowerCase()} brought the most, ${formatFull(top.n)} each.`;
  }
  return `${top.label} brought the most: ${formatFull(top.n)} of ${formatFull(total)}.`;
}

/**
 * The one bold moment on the page, in spiralny.com's charcoal: the hero figure
 * (completed sign-ups) and a tall segmented bar of where they came from.
 * Series colours switch to their dark-surface steps inside the band (.hero-band).
 */
export function SignupsHero({
  signups,
  leads,
  buckets,
  sample,
  periodLabel,
}: {
  signups: Kpi;
  leads: Kpi;
  buckets: SourceBucket[];
  sample: boolean;
  periodLabel: string;
}) {
  const total = buckets.reduce((s, b) => s + SOURCE_SERIES.reduce((t, x) => t + b[x.key], 0), 0);
  const parts: Part[] = SOURCE_SERIES.map((s) => {
    const n = buckets.reduce((sum, b) => sum + b[s.key], 0);
    return { ...s, n, share: total ? n / total : 0 };
  });
  const shown = parts.filter((p) => p.n > 0);

  return (
    <section aria-labelledby="hero-label" className="hero-band rounded-2xl bg-[#252526] p-5 text-sidebar-foreground shadow-sm ring-1 ring-white/5 sm:p-7">
      <div className="grid gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="hero-label" className="text-sm font-medium text-sidebar-muted">
              Completed sign-ups, last {periodLabel}
            </h2>
            {sample && <SampleBadge />}
          </div>
          <p className="mt-2 text-[3.5rem] leading-none font-semibold tracking-tight sm:text-[4.25rem]">
            {formatFull(signups.value)}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            <Delta kpi={signups} inverse suffix={` the ${periodLabel} before`} />
            <p className="text-sm text-sidebar-muted">
              out of {formatFull(leads.value)} new {leads.value === 1 ? "lead" : "leads"}
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-sidebar-muted">Where they came from</p>
          <p className="mt-1 text-lg leading-snug font-semibold text-balance">{insight(parts, total, periodLabel)}</p>

          {total > 0 ? (
            <div
              role="list"
              aria-label="Sign-ups by source"
              className="mt-4 flex h-7 w-full gap-[2px]"
            >
              {shown.map((p) => {
                const pct = Math.round(p.share * 100);
                return (
                  <div
                    key={p.key}
                    role="listitem"
                    tabIndex={0}
                    aria-label={`${p.label}: ${formatFull(p.n)} sign-ups, ${pct}%`}
                    className="group relative flex h-full min-w-[3px] items-center rounded-[4px] outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#252526]"
                    style={{ flexGrow: p.n, flexBasis: 0, background: p.color }}
                  >
                    {/* Share printed inside only when it fits (≥12% of the bar); otherwise hover, focus and the table carry it. */}
                    {p.share >= 0.12 && <span className="px-2 text-xs font-semibold text-[#141414]">{pct}%</span>}
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 hidden rounded-lg border bg-popover px-3 py-2 text-sm whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block"
                    >
                      <span className="font-semibold">{formatFull(p.n)}</span>{" "}
                      <span className="text-muted-foreground">
                        {p.label} ({pct}%)
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 h-7 rounded-[4px] bg-sidebar-accent" aria-hidden />
          )}

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            {parts.map((p) => (
              <li key={p.key} className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: p.color }} />
                <span className="text-sidebar-muted">{p.label}</span>
                <span className="font-semibold">{formatFull(p.n)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
