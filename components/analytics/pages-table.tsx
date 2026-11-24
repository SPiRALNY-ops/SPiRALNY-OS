"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { PAGE_GROUPS, type PageGroupKey } from "@/lib/analytics/groups";
import type { PageRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FilterChips, RowFigure, ShowMore, SortHeader, SortSelect, ariaSort, useSort } from "./table-tools";

type Col = "path" | "visits" | "googleClicks" | "leads" | "signups";
type NumCol = Exclude<Col, "path">;
const GROUP_LABEL = Object.fromEntries(PAGE_GROUPS.map((g) => [g.key, g.label])) as Record<PageGroupKey, string>;
const SHOWN = 12;
const UNIT: Record<NumCol, [string, string]> = {
  visits: ["visit", "visits"],
  googleClicks: ["Google click", "Google clicks"],
  leads: ["lead", "leads"],
  signups: ["sign-up", "sign-ups"],
};

const pageUrl = (path: string) => (path.startsWith("http") ? path : `https://spiralny.com${path}`);

function Num({ value, missing }: { value: number | null; missing: string }) {
  if (value === null)
    return (
      <span className="text-muted-foreground" title={missing}>
        —
      </span>
    );
  return <>{formatFull(value)}</>;
}

/** The Google searches behind one page (shown when its row is opened). */
function Searches({ row }: { row: PageRow }) {
  return (
    <>
      <p className="mb-2 text-xs font-medium text-muted-foreground">Google searches that led to this page</p>
      <ul className="grid gap-2 text-sm sm:gap-1.5">
        {row.topSearches.map((s) => (
          <li key={s.query} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
            <span className="min-w-0 truncate sm:flex-1">{s.query}</span>
            <span className="text-xs text-muted-foreground tabular">
              {plural(s.clicks, "click", "clicks")}, shown {plural(s.impressions, "time", "times")}, position {formatPosition(s.position)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

/** spiralny.com pages: visits, Google clicks, leads and sign-ups; open a row for its Google searches. */
export function PagesTable({ rows }: { rows: PageRow[] }) {
  const [group, setGroup] = useState<PageGroupKey | "all">("all");
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const filtered = useMemo(() => (group === "all" ? rows : rows.filter((r) => r.group === group)), [rows, group]);
  const value = useCallback((r: PageRow, k: Col) => (k === "path" ? r.path : r[k]), []);
  const { sorted, sort, toggle, setSort } = useSort<PageRow, Col>(filtered, { key: "googleClicks", dir: "desc" }, value);
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
    ] as [NumCol, string, boolean][]
  ).filter(([, , show]) => show);
  const colSpan = cols.length + 1 + (hasVisits && hasForms ? 1 : 0);
  const counts = (k: PageGroupKey) => rows.filter((r) => r.group === k).length;
  const options = [
    { key: "all" as const, label: "All pages", count: rows.length },
    ...PAGE_GROUPS.filter((g) => counts(g.key)).map((g) => ({ key: g.key, label: g.label, count: counts(g.key) })),
  ];
  // Phones show one figure on the right: the one the list is sorted by.
  const primary: NumCol = sort.key === "path" ? "googleClicks" : sort.key;
  const others = cols.map(([k]) => k).filter((k) => k !== primary);

  return (
    <div>
      <FilterChips label="Filter pages" options={options} value={group} onChange={(k) => { setGroup(k); setAll(false); }} />

      {/* Phones and tablets: a list; each row opens to its searches. */}
      <div className="xl:hidden">
        <div className="mt-3 flex items-center justify-between gap-3 border-b pb-2.5">
          <p className="text-xs text-muted-foreground">{plural(sorted.length, "page", "pages")}</p>
          <SortSelect
            sort={sort}
            onChange={setSort}
            options={[...cols.map(([k, label]) => ({ key: k as Col, label })), { key: "path" as Col, label: "Page name", numeric: false }]}
          />
        </div>
        <ul className="divide-y">
          {visible.map((r) => {
            const expanded = open.has(r.path);
            const canOpen = r.topSearches.length > 0;
            const figure = r[primary];
            const rest = others
              .map((k) => (r[k] === null ? null : plural(r[k] as number, UNIT[k][0], UNIT[k][1])))
              .filter(Boolean)
              .join(", ");
            return (
              <li key={r.path}>
                <button
                  type="button"
                  onClick={() => toggleRow(r.path)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.path}</p>
                    <p className="truncate text-xs text-muted-foreground">{GROUP_LABEL[r.group]}</p>
                    {rest && <p className="mt-1 text-xs text-muted-foreground tabular">{rest}</p>}
                  </div>
                  <RowFigure
                    value={figure === null ? "—" : formatFull(figure)}
                    unit={figure === 1 ? UNIT[primary][0].replace("Google ", "") : UNIT[primary][1].replace("Google ", "")}
                  />
                  <ChevronDown aria-hidden className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                </button>
                {expanded && (
                  <div className="mb-3 rounded-lg bg-muted/60 p-3">
                    {canOpen ? <Searches row={r} /> : <p className="text-xs text-muted-foreground">Google didn&apos;t share the searches for this page.</p>}
                    <a
                      href={pageUrl(r.path)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline"
                    >
                      Open on spiralny.com <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Wide screens (every column fits): the sortable table. */}
      <div className="relative mt-3 hidden overflow-x-auto xl:block">
        <table className={cn("w-full text-sm", hasForms ? "min-w-[680px]" : "min-w-[480px]")}>
          <thead>
            <tr className="border-b text-xs">
              <th scope="col" aria-sort={ariaSort(sort, "path")} className="py-2 pr-3 text-left font-medium">
                <SortHeader label="Page on spiralny.com" column="path" sort={sort} onSort={toggle} numeric={false} align="left" />
              </th>
              {cols.map(([k, label]) => (
                <th key={k} scope="col" aria-sort={ariaSort(sort, k)} className="py-2 pr-3 text-right font-medium last:pr-0">
                  <SortHeader label={label} column={k} sort={sort} onSort={toggle} />
                </th>
              ))}
              {hasVisits && hasForms && (
                <th scope="col" className="py-2 text-right font-medium whitespace-nowrap text-muted-foreground">
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
                    <td className="max-w-[340px] py-2.5 pr-3">
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
                              href={pageUrl(r.path)}
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
                    <td className={cn("py-2.5 pr-3 text-right font-medium tabular", !hasForms && "pr-0")}>{formatFull(r.googleClicks)}</td>
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
                      <td className="py-2.5 text-right text-muted-foreground tabular">
                        {rate === null ? "—" : rate === 0 ? "0%" : formatPercent(rate)}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="border-b bg-muted/40">
                      <td colSpan={colSpan} className="py-3 pr-4 pl-7">
                        <Searches row={r} />
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
