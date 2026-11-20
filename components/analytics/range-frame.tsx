"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Pill-shaped, like the buttons on spiralny.com. The selected range is the filled charcoal pill. */}
        <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-full border bg-card p-1 shadow-xs">
          {RANGE_KEYS.map((key) => {
            const selected = key === current;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={RANGES[key].label}
                onClick={() => choose(key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:px-4",
                  selected
                    ? "bg-primary font-semibold text-primary-foreground"
                    : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {RANGES[key].label.replace(/^Last /, "")}
              </button>
            );
          })}
        </div>
        {pending && (
          <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
            Updating…
          </span>
        )}
        {aside && <div className="ml-auto text-xs text-muted-foreground">{aside}</div>}
      </div>
      <div aria-busy={pending} className={cn("flex flex-col gap-5 transition-opacity", pending && "opacity-50")}>
        {children}
      </div>
    </div>
  );
}
