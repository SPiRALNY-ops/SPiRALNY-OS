import { CircleCheck, Clock } from "lucide-react";
import type { SourceStatus } from "@/lib/analytics/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";
import { InfoTip } from "./info-tip";

/**
 * Says plainly which numbers are real and which are samples. With everything
 * waiting it explains at length; once sources are live it shrinks to one line.
 */
export function SourcesBanner({ sources }: { sources: SourceStatus[] }) {
  const live = sources.filter((s) => s.origin === "real");
  const latest = live.map((s) => s.lastSuccessAt).filter((d): d is string => Boolean(d)).sort().at(-1);

  if (live.length === 0) {
    return (
      <section aria-label="Data sources" className="rounded-xl border border-l-4 border-l-brand bg-card p-4 shadow-xs sm:p-5">
        <p className="font-bold">These are sample numbers for now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Each section marked <SampleBadge className="mx-0.5 align-[1px]" /> switches to Spiral NY&apos;s real numbers as soon as its
          source is connected.
        </p>
        <ul className="mt-4 grid gap-x-2 gap-y-2.5 sm:grid-cols-2 sm:gap-y-2 lg:grid-cols-3 xl:grid-cols-5">
          {sources.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5 sm:rounded-lg sm:bg-muted/70 sm:px-3 sm:py-2.5">
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 text-sm">
                <p className="font-semibold max-sm:inline">{s.label}</p>
                <span className="text-muted-foreground sm:hidden">: </span>
                <p className="text-muted-foreground max-sm:inline">Waiting for {s.waitingFor}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const allLive = live.length === sources.length;
  return (
    <section aria-label="Data sources" className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border bg-card px-4 py-3 shadow-xs">
      <p className="flex items-start gap-2 text-sm">
        {allLive && <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-good md:hidden" />}
        <span>
          <span className="font-semibold">
            {allLive ? `Live data from all ${sources.length} sources` : `Live data from ${live.length} of ${sources.length} sources`}
          </span>
          {latest && <span className="text-muted-foreground">, updated {relativeTime(latest)}</span>}
        </span>
      </p>
      {/* With everything live the chips only repeat the sentence, so phones skip them. */}
      <ul className={cn("flex-wrap gap-1.5", allLive ? "hidden md:flex" : "flex")}>
        {sources.map((s) => {
          const real = s.origin === "real";
          return (
            <li
              key={s.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                real ? "bg-card" : "border-dashed border-brand/60 bg-brand-soft",
              )}
            >
              {real ? (
                <CircleCheck aria-hidden className="size-3.5 text-good" />
              ) : (
                <Clock aria-hidden className="size-3.5 text-muted-foreground" />
              )}
              <span className="font-medium">{s.label}</span>
              {real ? (
                <span className="sr-only">: live</span>
              ) : (
                <>
                  <span className="text-muted-foreground">sample</span>
                  <InfoTip label={`${s.label} status`}>
                    Waiting for {s.waitingFor}. Sections from this source show labelled sample numbers until then.
                  </InfoTip>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
