"use client";

import { useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { LongView, SearchDeep } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition, pageLabel, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ItemLink } from "./detail-panel";
import { Section } from "./section";
import { Sparkline } from "./sparkline";
import { FilterChips, ShowMore } from "./table-tools";

const OPPORTUNITIES_SHOWN = 10;

/** Recruiting searches where spiralny.com sits at positions 4–20: the closest wins. */
export function Opportunities({ deep, periodLabel }: { deep: SearchDeep; periodLabel: string }) {
  const [all, setAll] = useState(false);
  const o = deep.opportunities;
  const rows = all ? o.rows : o.rows.slice(0, OPPORTUNITIES_SHOWN);
  return (
    <div id="opportunities" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Almost on page one"
        sample={false}
        description={
          o.total
            ? `${plural(o.total, "recruiting search", "recruiting searches")} showed spiralny.com ${formatFull(o.impressions)} times at positions 4 to 20 in the last ${periodLabel}, and brought ${plural(o.clicks, "click", "clicks")}. Moving one into the top three is where the clicks are.`
            : `No recruiting search sat at positions 4 to 20 in the last ${periodLabel}.`
        }
        footer={`Recruiting searches (commission, splits, brokerage, licenses, referral agents, joining) shown at least 10 times, sorted by times shown. "Page" is the spiralny.com page Google showed most for it. Tap a search or page for its 16 months.`}
      >
        <PositionStrip deep={deep} />
        {o.total > 0 && (
          <>
            <ul className="mt-4 divide-y">
              {rows.map((r) => (
                <li key={r.query} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 py-2.5 first:pt-0">
                  <ItemLink kind="search" id={r.query} className="font-medium">
                    {r.query}
                  </ItemLink>
                  <span className="text-right">
                    <span className="font-semibold tabular">{formatFull(r.impressions)}</span>
                    <span className="block text-xs text-muted-foreground">times shown</span>
                  </span>
                  <span className="col-span-2 text-xs text-muted-foreground">
                    Position {formatPosition(r.position)}, {plural(r.clicks, "click", "clicks")}. Page:{" "}
                    <ItemLink kind="page" id={r.path} className="text-foreground">
                      {pageLabel(r.path)}
                    </ItemLink>
                  </span>
                </li>
              ))}
            </ul>
            <ShowMore shown={OPPORTUNITIES_SHOWN} total={o.rows.length} expanded={all} onToggle={() => setAll((v) => !v)} />
            {o.total > o.rows.length && (
              <p className="mt-2 text-xs text-muted-foreground">The {formatFull(o.rows.length)} most-shown of {formatFull(o.total)}.</p>
            )}
          </>
        )}
      </Section>
    </div>
  );
}

const POSITION_LABELS: Record<string, string> = {
  top3: "Top 3",
  page1: "Rest of page one (4–10)",
  page2: "Page two (11–20)",
  deeper: "Lower (21+)",
};

/** Why page one matters, in Spiral NY's own numbers: how often people clicked at each position. */
function PositionStrip({ deep }: { deep: SearchDeep }) {
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-muted-foreground">Share of people who clicked spiralny.com, by where it showed in Google:</figcaption>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        {deep.positions.map((p) => {
          const rate = p.impressions ? p.clicks / p.impressions : 0;
          return (
            <div key={p.key} className="bg-card px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{POSITION_LABELS[p.key] ?? p.label}</dt>
              <dd className="text-lg leading-tight font-semibold tabular">{p.impressions ? formatPercent(rate, rate < 0.01 ? 2 : 1) : "—"}</dd>
              <dd className="text-xs text-muted-foreground">
                {formatFull(p.clicks)} of {formatFull(p.impressions)}
              </dd>
            </div>
          );
        })}
      </dl>
    </figure>
  );
}

/** Pages and searches whose clicks rose or fell most against the period before. */
export function Movers({ deep, periodLabel }: { deep: SearchDeep; periodLabel: string }) {
  const [kind, setKind] = useState<"pages" | "searches">("pages");
  if (!deep.movers) {
    return (
      <div id="movers" className="scroll-mt-32 lg:scroll-mt-20">
        <Section title="Rising and falling" sample={false} description="Search Console doesn't cover the whole period before this one yet, so there's nothing to compare with." />
      </div>
    );
  }
  const rows = deep.movers[kind];
  const up = rows.filter((r) => r.now > r.before);
  const down = rows.filter((r) => r.now < r.before);
  const list = (items: typeof rows, rising: boolean) => (
    <div className="min-w-0">
      <h4 className="mb-1.5 text-sm font-semibold">{rising ? "Gaining clicks" : "Losing clicks"}</h4>
      {items.length ? (
        <ul className="divide-y">
          {items.map((r) => {
            const Icon = rising ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2">
                <ItemLink kind={kind === "pages" ? "page" : "search"} id={r.key} className="truncate text-sm font-medium">
                  <span title={r.label}>{kind === "pages" ? pageLabel(r.label) : r.label}</span>
                </ItemLink>
                <span className={cn("inline-flex items-center gap-0.5 text-sm font-semibold tabular", rising ? "text-good" : "text-bad")}>
                  <Icon aria-hidden className="size-3.5" strokeWidth={2.5} />
                  {rising ? "+" : "−"}
                  {formatFull(Math.abs(r.now - r.before))}
                </span>
                <span className="col-span-2 text-xs text-muted-foreground">
                  {formatFull(r.now)} clicks, from {formatFull(r.before)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">None.</p>
      )}
    </div>
  );
  return (
    <div id="movers" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Rising and falling"
        sample={false}
        description={`The biggest changes in Google clicks: the last ${periodLabel} against the ${periodLabel} before.`}
        footer="Pages and searches with at least 3 clicks in one of the two periods. Tap one for its 16 months."
      >
        <FilterChips
          label="Show"
          options={[
            { key: "pages" as const, label: "Pages" },
            { key: "searches" as const, label: "Searches" },
          ]}
          value={kind}
          onChange={setKind}
        />
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          {list(up, true)}
          {list(down, false)}
        </div>
      </Section>
    </div>
  );
}

const COMPETING_SHOWN = 6;

/** Searches where two or more Spiral NY pages show up as separate results. */
export function CompetingPages({ deep, periodLabel }: { deep: SearchDeep; periodLabel: string }) {
  const [all, setAll] = useState(false);
  const c = deep.competing;
  const rows = all ? c.rows : c.rows.slice(0, COMPETING_SHOWN);
  return (
    <div id="competing" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Your pages competing with each other"
        sample={false}
        description={
          c.total
            ? `In the last ${periodLabel}, ${plural(c.total, "search", "searches")} showed two or more spiralny.com pages as separate results (${formatFull(c.recruiting)} of them recruiting). Google tends to rank both lower; one clear page per topic usually does better.`
            : `No search showed two spiralny.com pages as separate results in the last ${periodLabel}.`
        }
        footer="Pages shown at least 10 times for the search. Pages at the same position are one result (Google's extra links under a result), so they don't count as competing."
      >
        {c.total > 0 && (
          <>
            <ul className="divide-y">
              {rows.map((r) => (
                <li key={r.query} className="py-2.5 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <ItemLink kind="search" id={r.query} className="font-medium">
                      {r.query}
                    </ItemLink>
                    <span className="shrink-0 text-xs text-muted-foreground">shown {formatFull(r.impressions)} times</span>
                  </div>
                  <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                    {r.pages.map((p) => (
                      <li key={p.path}>
                        <ItemLink kind="page" id={p.path} className="text-foreground">
                          {pageLabel(p.path)}
                        </ItemLink>{" "}
                        at position {formatPosition(p.position)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            <ShowMore shown={COMPETING_SHOWN} total={c.rows.length} expanded={all} onToggle={() => setAll((v) => !v)} />
          </>
        )}
      </Section>
    </div>
  );
}

/** The main recruiting pages, month by month over 16 months. */
export function RecruitingPagesTrend({ search }: { search: NonNullable<LongView["search"]> }) {
  const full = search.months.map((m, i) => (m.partial ? -1 : i)).filter((i) => i >= 0);
  const last3 = full.slice(-3);
  const prev3 = full.slice(-6, -3);
  const sum = (values: number[], idx: number[]) => idx.reduce((s, i) => s + values[i], 0);
  const label = (idx: number[]) => (idx.length ? `${search.months[idx[0]].label} to ${search.months[idx.at(-1)!].label}` : "");
  return (
    <div id="recruiting-pages" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Recruiting pages over time"
        sample={false}
        description="Google clicks on the recruiting pages that get the most, month by month for 16 months. The period picker doesn't change this."
        footer={`"Last 3 months" are the last three complete months (${label(last3)}), against the three before (${label(prev3)}).`}
      >
        {search.recruitingPages.length ? (
          <ul className="divide-y">
            {search.recruitingPages.map((p) => {
              const now = sum(p.monthly, last3);
              const before = sum(p.monthly, prev3);
              const change = before ? (now - before) / before : null;
              return (
                <li key={p.path} className="grid grid-cols-[minmax(0,1fr)_5.5rem_auto] items-center gap-x-3 py-2.5 first:pt-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                  <ItemLink kind="page" id={p.path} className="truncate text-sm font-medium">
                    {p.path}
                  </ItemLink>
                  <Sparkline values={p.monthly.map((v, i) => (search.months[i].partial ? null : v))} className="h-7 w-full" />
                  <span className="text-right">
                    <span className="font-semibold tabular">{formatFull(p.clicks)}</span>
                    <span className="block text-xs text-muted-foreground">clicks</span>
                  </span>
                  <span className="col-span-3 text-xs text-muted-foreground">
                    Last 3 months: {formatFull(now)} clicks, against {formatFull(before)} the 3 before
                    {change !== null && (
                      <span className={cn("ml-1 font-semibold", change >= 0 ? "text-good" : "text-bad")}>
                        ({change >= 0 ? "+" : "−"}
                        {formatPercent(Math.abs(change), 0)})
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No recruiting page has Google clicks yet.</p>
        )}
      </Section>
    </div>
  );
}
