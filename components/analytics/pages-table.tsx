"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { PAGE_GROUPS, type PageGroupKey } from "@/lib/analytics/groups";
import type { PageRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FilterChips, ShowMore, SortHeader, ariaSort, useSort } from "./table-tools";

type Col = "path" | "visits" | "googleClicks" | "leads" | "signups";
const GROUP_LABEL = Object.fromEntries(PAGE_GROUPS.map((g) => [g.key, g.label])) as Record<PageGroupKey, string>;
const SHOWN = 12;

function Num({ value, missing }: { value: number | null; missing: string }) {
  if (value === null)
    return (
      <span className="text-muted-foreground" title={missing}>
        —
      </span>
    );
  return <>{formatFull(value)}</>;
}

/** spiralny.com pages: visits, Google clicks, leads and sign-ups; open a row for its Google searches. */
export function PagesTable({ rows }: { rows: PageRow[] }) {
  const [group, setGroup] = useState<PageGroupKey | "all">("all");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => (group === "all" ? rows : rows.filter((r) => r.group === group)), [rows, group]);
  const value = useCallback((r: PageRow, k: Col) => (k === "path" ? r.path : r[k]), []);
  const { sorted, sort, toggle } = useSort<PageRow, Col>(filtered, { key: "googleClicks", dir: "desc" }, value);
  const visible = all ? sorted : sorted.slice(0, SHOWN);

  const toggleRow = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No page data for this period yet.</p>;
  }

  const hasVisits = rows.some((r) => r.visits !== null);
  const hasForms = rows.some((r) => r.leads !== null);
  const cols = (
    [
      ["visits", "Visits", hasVisits],
      ["googleClicks", "Google clicks", true],
      ["leads", "Leads", hasForms],
      ["signups", "Sign-ups", hasForms],
    ] as [Col, string, boolean][]
  ).filter(([, , show]) => show);
  const colSpan = cols.length + 1 + (hasVisits && hasForms ? 1 : 0);
  const counts = (k: PageGroupKey) => rows.filter((r) => r.group === k).length;
  const options = [
    { key: "all" as const, label: "All pages", count: rows.length },
    ...PAGE_GROUPS.filter((g) => counts(g.key)).map((g) => ({ key: g.key, label: g.label, count: counts(g.key) })),
  ];

  return (
    <div>
      <FilterChips label="Filter pages" options={options} value={group} onChange={(k) => { setGroup(k); setAll(false); }} />
      <div className="-mx-4 mt-3 overflow-x-auto sm:mx-0">
        <table className={cn("w-full text-sm", hasForms ? "min-w-[680px]" : "min-w-[480px]")}>
          <thead>
            <tr className="border-b text-xs">
              <th scope="col" aria-sort={ariaSort(sort, "path")} className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                <SortHeader label="Page on spiralny.com" column="path" sort={sort} onSort={toggle} numeric={false} align="left" />
              </th>
              {cols.map(([k, label]) => (
                <th key={k} scope="col" aria-sort={ariaSort(sort, k)} className="py-2 pr-3 text-right font-medium last:pr-4 sm:last:pr-0">
                  <SortHeader label={label} column={k} sort={sort} onSort={toggle} />
                </th>
              ))}
              {hasVisits && hasForms && (
                <th scope="col" className="py-2 pr-4 text-right font-medium text-muted-foreground sm:pr-0">
                  Visit → sign-up
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const expanded = open.has(r.path);
              const rate = r.visits && r.signups !== null ? r.signups / r.visits : null;
              return (
                <Fragment key={r.path}>
                  <tr className="border-b transition-colors hover:bg-muted/50">
                    <td className="max-w-[340px] py-2.5 pr-3 pl-4 sm:pl-0">
                      <div className="flex items-start gap-1.5">
                        <button
                          type="button"
                          onClick={() => toggleRow(r.path)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? "Hide" : "Show"} Google searches for ${r.path}`}
                          disabled={r.topSearches.length === 0}
                          className="mt-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30"
                        >
                          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium" title={r.path}>
                              {r.path}
                            </span>
                            <a
                              href={r.path.startsWith("http") ? r.path : `https://spiralny.com${r.path}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${r.path} on spiralny.com`}
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="size-3.5" />
                            </a>
                          </div>
                          <span className="text-xs text-muted-foreground">{GROUP_LABEL[r.group]}</span>
                        </div>
                      </div>
                    </td>
                    {hasVisits && (
                      <td className="py-2.5 pr-3 text-right tabular">
                        <Num value={r.visits} missing="Shows once Google Analytics is connected" />
                      </td>
                    )}
                    <td className={cn("py-2.5 pr-3 text-right font-medium tabular", !hasForms && "pr-4 sm:pr-0")}>{formatFull(r.googleClicks)}</td>
                    {hasForms && (
                      <>
                        <td className="py-2.5 pr-3 text-right tabular">
                          <Num value={r.leads} missing="Shows once form entries arrive" />
                        </td>
                        <td className="py-2.5 pr-3 text-right font-medium tabular">
                          <Num value={r.signups} missing="Shows once form entries arrive" />
                        </td>
                      </>
                    )}
                    {hasVisits && hasForms && (
                      <td className="py-2.5 pr-4 text-right text-muted-foreground tabular sm:pr-0">
                        {rate === null ? "—" : formatPercent(rate)}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="border-b bg-muted/40">
                      <td colSpan={colSpan} className="py-3 pr-4 pl-11">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Google searches that led to this page</p>
                        <ul className="grid gap-1.5 text-sm">
                          {r.topSearches.map((s) => (
                            <li key={s.query} className="flex flex-wrap items-baseline gap-x-3">
                              <span className="min-w-0 flex-1 truncate">{s.query}</span>
                              <span className="text-xs text-muted-foreground tabular">
                                {formatFull(s.clicks)} clicks, shown {formatFull(s.impressions)} times, position {formatPosition(s.position)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No pages in this group for this period.</p>}
      <ShowMore shown={SHOWN} total={sorted.length} expanded={all} onToggle={() => setAll((v) => !v)} />
      {!hasForms && (
        <p className="mt-3 text-xs text-muted-foreground">Leads and sign-ups for each page appear here once sign-up form entries start arriving.</p>
      )}
    </div>
  );
}
