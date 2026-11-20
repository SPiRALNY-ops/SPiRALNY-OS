"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { RANGE_KEYS, RANGES } from "@/lib/analytics/range";
import type { RangeKey } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

/**
 * The one filter row above everything it scopes. Changing the range keeps the
 * current numbers on screen (dimmed) until the new ones are ready.
 */
export function RangeFrame({
  current,
  aside,
  children,
}: {
  current: RangeKey;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const choose = (key: RangeKey) => {
    if (key === current) return;
    startTransition(() => router.push(`${pathname}?range=${key}`, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Date range" className="flex flex-wrap rounded-lg border bg-card p-0.5">
          {RANGE_KEYS.map((key) => {
            const selected = key === current;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                  selected ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {selected && <Check aria-hidden className="size-4" strokeWidth={3} />}
                <span className="hidden sm:inline">Last&nbsp;</span>
                {RANGES[key].label.replace(/^Last /, "")}
              </button>
            );
          })}
        </div>
        {pending && <span className="text-xs text-muted-foreground">Updating…</span>}
        {aside && <div className="ml-auto text-xs text-muted-foreground">{aside}</div>}
      </div>
      <div aria-busy={pending} className={cn("flex flex-col gap-4 transition-opacity", pending && "opacity-50")}>
        {children}
      </div>
    </div>
  );
}
