"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { RANGE_KEYS, RANGES } from "@/lib/analytics/range";
import type { RangeKey } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";
import { useEdgeFade } from "./scroll-row";

export type Chapter = { id: string; label: string };

/**
 * The chapter being read: the last one whose top has passed a line just under
 * the sticky bars (or the last chapter, once the page can't scroll further).
 * After a chapter link is pressed, that chapter stays lit until the scroll settles.
 */
function useActiveChapter(ids: string[]) {
  const key = ids.join(",");
  const [active, setActive] = useState(ids[0]);
  const locked = useRef(false);
  const settle = useRef<number | undefined>(undefined);

  useEffect(() => {
    const list = key.split(",");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (locked.current) return;
      const els = list.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
      if (!els.length) return;
      const line = Math.min(window.innerHeight * 0.35, 220);
      let current = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= line) current = el.id;
      const last = els[els.length - 1];
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && last.getBoundingClientRect().top < window.innerHeight) current = last.id;
      setActive(current);
    };
    const onScroll = () => {
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        locked.current = false;
        update();
      }, 140);
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      window.clearTimeout(settle.current);
    };
  }, [key]);

  const choose = useCallback((id: string) => {
    locked.current = true;
    setActive(id);
    // If the page doesn't need to scroll, nothing would unlock it.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => (locked.current = false), 1200);
  }, []);
  return [active, choose] as const;
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
  const [navRef, fadeClass] = useEdgeFade<HTMLElement>();

  // Keep the lit chapter link in view when the row scrolls sideways (phones).
  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelector<HTMLElement>("[aria-current]");
    if (!nav || !link || nav.scrollWidth <= nav.clientWidth) return;
    const left = link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active, navRef]);

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
      <div className="sticky top-14 z-20 -mx-4 border-b bg-background px-4 py-2.5 sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="flex items-center gap-3">
          <nav ref={navRef} aria-label="Analytics sections" className={cn("no-scrollbar -my-1 min-w-0 flex-1 overflow-x-auto py-1", fadeClass)}>
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
