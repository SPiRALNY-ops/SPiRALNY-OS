"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { RANGE_KEYS, RANGES } from "@/lib/analytics/range";
import type { RangeKey } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

export type Chapter = { id: string; label: string };

/** Highlights the chapter whose heading was passed most recently while scrolling. */
function useActiveChapter(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -60% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return [active, setActive] as const;
}

/**
 * The page's one filter row, kept in view while scrolling: chapter links on the
 * left, the date range on the right (a native picker on phones). Changing the
 * range keeps the current numbers on screen, dimmed, until the new ones are ready.
 */
export function RangeFrame({
  current,
  chapters,
  children,
}: {
  current: RangeKey;
  chapters: Chapter[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useActiveChapter(chapters.map((c) => c.id));

  const choose = (key: RangeKey) => {
    if (key === current) return;
    startTransition(() => router.push(`${pathname}?range=${key}`, { scroll: false }));
  };
  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background/90 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3">
          <nav aria-label="Analytics sections" className="-my-1 min-w-0 flex-1 overflow-x-auto py-1">
            <ul className="flex gap-1">
              {chapters.map((c) => (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      jump(c.id);
                    }}
                    aria-current={active === c.id ? "location" : undefined}
                    className={cn(
                      "block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                      active === c.id ? "bg-brand-soft font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {c.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {pending && <LoaderCircle aria-label="Updating" className="size-4 shrink-0 animate-spin text-muted-foreground" />}

          {/* Pill-shaped, like the buttons on spiralny.com. */}
          <div role="radiogroup" aria-label="Date range" className="hidden shrink-0 rounded-full border bg-card p-1 shadow-xs md:inline-flex">
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
                    "rounded-full px-3.5 py-1 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                    selected ? "bg-primary font-semibold text-primary-foreground" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {RANGES[key].label.replace(/^Last /, "")}
                </button>
              );
            })}
          </div>
          <label className="relative shrink-0 md:hidden">
            <span className="sr-only">Date range</span>
            <select
              value={current}
              onChange={(e) => choose(e.target.value as RangeKey)}
              className="appearance-none rounded-full border bg-primary py-1.5 pr-8 pl-3.5 text-sm font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {RANGE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {RANGES[key].label.replace(/^Last /, "")}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-primary-foreground" />
          </label>
        </div>
      </div>
      <div aria-busy={pending} className={cn("flex flex-col gap-5 transition-opacity", pending && "opacity-50")}>
        {children}
      </div>
    </div>
  );
}
