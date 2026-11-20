import { CircleCheck, Clock } from "lucide-react";
import type { SourceStatus } from "@/lib/analytics/types";
import { relativeTime } from "@/lib/format";

/** Says plainly which numbers are real and which are samples waiting on access. */
export function SourcesBanner({ sources }: { sources: SourceStatus[] }) {
  const waiting = sources.filter((s) => s.origin === "sample");
  const connected = sources.filter((s) => s.origin === "real");

  return (
    <section
      aria-label="Data sources"
      className={
        waiting.length
          ? "rounded-xl border border-brand/40 bg-brand-soft p-4"
          : "rounded-xl border bg-card p-4"
      }
    >
      {waiting.length > 0 && (
        <>
          <p className="font-semibold">
            {connected.length === 0 ? "These are sample numbers." : "Some sections still show sample numbers."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Each section marked <span className="font-medium text-foreground">Sample data</span> switches to Spiral NY&apos;s
            real numbers as soon as its source is connected.
          </p>
        </>
      )}
      <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {sources.map((s) => (
          <li key={s.key} className="flex items-start gap-2">
            {s.origin === "real" ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-good" />
            ) : (
              <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span>
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                {s.origin === "real" && s.lastSuccessAt
                  ? ` · connected, updated ${relativeTime(s.lastSuccessAt)}`
                  : ` · waiting for ${s.waitingFor}`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
