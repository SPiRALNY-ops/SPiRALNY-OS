"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { RANGE_KEYS, RANGES } from "@/lib/analytics/range";
import type { RangeKey } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";
import { useEdgeFade } from "./scroll-row";

/** The Analytics pages, in the order they read. */
export const ANALYTICS_TABS = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/leads", label: "Leads & sign-ups" },
  { href: "/analytics/search", label: "Google search" },
  { href: "/analytics/website", label: "Website" },
  { href: "/analytics/cold-email", label: "Cold email" },
] as const;

/** Links to the old one-page dashboard's chapters (#search…) open the page that holds them now. */
const OLD_CHAPTERS: Record<string, string> = {
  "#leads": "/analytics/leads",
  "#search": "/analytics/search",
  "#website": "/analytics/website",
  "#cold": "/analytics/cold-email",
};

/**
 * Every Analytics page's one control row, kept in view while scrolling: the pages on the left and
 * the period on the right (a native picker on phones). The period carries over between pages.
 * Changing it keeps the current numbers on screen, dimmed, until the new ones are ready.
 */
export function RangeFrame({ current, children }: { current: RangeKey; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [navRef, fadeClass] = useEdgeFade<HTMLElement>();

  // A link to a section (#opportunities…) scrolls there once the page's content is on screen.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    if (pathname === "/analytics" && OLD_CHAPTERS[hash]) {
      router.replace(`${OLD_CHAPTERS[hash]}?range=${current}`);
      return;
    }
    const frame = requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, router, current]);

  // Keep the current page's link in view when the row scrolls sideways (phones).
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollTo({ left: Math.max(0, link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2) });
  }, [pathname, navRef]);

  const choose = (key: RangeKey) => {
    if (key === current) return;
    startTransition(() => router.push(`${pathname}?range=${key}`, { scroll: false }));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background px-4 py-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3">
          <nav ref={navRef} aria-label="Analytics pages" className={cn("no-scrollbar -my-1 min-w-0 flex-1 overflow-x-auto py-1", fadeClass)}>
            <ul className="flex gap-1">
              {ANALYTICS_TABS.map((t) => {
                const active = pathname === t.href;
                return (
                  <li key={t.href}>
                    <Link
                      href={`${t.href}?range=${current}`}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block rounded-full px-3 py-1.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                        active ? "bg-brand-soft font-semibold text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              })}
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
