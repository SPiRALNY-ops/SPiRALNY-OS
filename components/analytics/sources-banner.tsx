import { CircleCheck, Clock } from "lucide-react";
import type { SourceStatus } from "@/lib/analytics/types";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";

/** Says plainly which numbers are real and which are samples waiting on access. */
export function SourcesBanner({ sources }: { sources: SourceStatus[] }) {
  const waiting = sources.filter((s) => s.origin === "sample").length;

  return (
    <section
      aria-label="Data sources"
      className={cn(
        "rounded-xl border bg-card p-4 shadow-xs sm:p-5",
        waiting > 0 && "border-l-4 border-l-brand",
      )}
    >
      {waiting > 0 ? (
        <div className="mb-4">
          <p className="font-bold">
            {waiting === sources.length ? "These are sample numbers for now" : "Some sections still show sample numbers"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Each section marked <SampleBadge className="mx-0.5 align-[1px]" /> switches to Spiral NY&apos;s real numbers
            as soon as its source is connected.
          </p>
        </div>
      ) : (
        <p className="mb-3 font-bold">All sources connected</p>
      )}
      <ul className="grid gap-x-2 gap-y-2.5 sm:grid-cols-2 sm:gap-y-2 xl:grid-cols-4">
        {sources.map((s) => {
          const real = s.origin === "real";
          return (
            <li key={s.key} className="flex items-start gap-2.5 sm:rounded-lg sm:bg-muted/70 sm:px-3 sm:py-2.5">
              {real ? (
                <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-good" />
              ) : (
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 text-sm">
                <p className="font-semibold max-sm:inline">{s.label}</p>
                <span className="text-muted-foreground sm:hidden">: </span>
                <p className="text-muted-foreground max-sm:inline">
                  {real
                    ? `Connected${s.lastSuccessAt ? `, updated ${relativeTime(s.lastSuccessAt)}` : ""}`
                    : `Waiting for ${s.waitingFor}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
