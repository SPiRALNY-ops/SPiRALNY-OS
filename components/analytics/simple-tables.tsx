"use client";

import { useCallback, useMemo, useState } from "react";
import { SEARCH_GROUPS, type SearchGroupKey } from "@/lib/analytics/groups";
import type { CampaignRow, SearchRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";
import { NotYet } from "./section";
import { FilterChips, RowFigure, ShowMore, SortHeader, SortSelect, ariaSort, useSort, type SortState } from "./table-tools";

const SEARCH_LABEL = Object.fromEntries(SEARCH_GROUPS.map((g) => [g.key, g.label])) as Record<SearchGroupKey, string>;

type SearchCol = "query" | "clicks" | "impressions" | "ctr" | "position";
type SearchNum = Exclude<SearchCol, "query">;

const ctr = (r: SearchRow) => (r.impressions ? r.clicks / r.impressions : null);

/** Each search figure in words, for the phone list ("shown 531 times", "position 1.1"). */
const SEARCH_WORDS: Record<SearchNum, (r: SearchRow) => string> = {
  clicks: (r) => plural(r.clicks, "click", "clicks"),
  impressions: (r) => `shown ${plural(r.impressions, "time", "times")}`,
  ctr: (r) => (ctr(r) === null ? "no click rate" : `${formatPercent(ctr(r)!)} click rate`),
  position: (r) => `position ${formatPosition(r.position)}`,
};
const SEARCH_FIGURE: Record<SearchNum, (r: SearchRow) => [string, string]> = {
  clicks: (r) => [formatFull(r.clicks), r.clicks === 1 ? "click" : "clicks"],
  impressions: (r) => [formatFull(r.impressions), "shown"],
  ctr: (r) => [ctr(r) === null ? "—" : formatPercent(ctr(r)!), "clicked"],
  position: (r) => [formatPosition(r.position), "position"],
};

/** The searches that showed spiralny.com, filterable by group and sortable by any column. */
export function SearchesTable({ rows }: { rows: SearchRow[] }) {
  const [group, setGroup] = useState<SearchGroupKey | "all">("all");
  const [all, setAll] = useState(false);
  const filtered = useMemo(() => (group === "all" ? rows : rows.filter((r) => r.group === group)), [rows, group]);
  const value = useCallback((r: SearchRow, k: SearchCol) => {
    if (k === "query") return r.query;
    if (k === "ctr") return ctr(r);
    return r[k];
  }, []);
  const { sorted, sort, toggle, setSort } = useSort<SearchRow, SearchCol>(filtered, { key: "clicks", dir: "desc" }, value);
  const SHOWN = 12;
  const visible = all ? sorted : sorted.slice(0, SHOWN);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No searches recorded for this period yet.</p>;
  }
  const count = (k: SearchGroupKey) => rows.filter((r) => r.group === k).length;
  const options = [
    { key: "all" as const, label: "All", count: rows.length },
    ...SEARCH_GROUPS.filter((g) => count(g.key)).map((g) => ({ key: g.key, label: g.label, count: count(g.key) })),
  ];
  const primary: SearchNum = sort.key === "query" ? "clicks" : sort.key;
  // Position: lower is better, so the picker sorts it best first.
  const pick = (next: SortState<SearchCol>) => setSort(next.key === "position" ? { key: "position", dir: "asc" } : next);

  return (
    <div>
      <FilterChips label="Filter searches" options={options} value={group} onChange={(k) => { setGroup(k); setAll(false); }} />

      <div className="sm:hidden">
        <div className="mt-3 flex items-center justify-between gap-3 border-b pb-2.5">
          <p className="text-xs text-muted-foreground">{plural(sorted.length, "search", "searches")}</p>
          <SortSelect
            sort={sort}
            onChange={pick}
            options={[
              { key: "clicks", label: "Clicks" },
              { key: "impressions", label: "Times shown" },
              { key: "ctr", label: "Click rate" },
              { key: "position", label: "Best position" },
              { key: "query", label: "A to Z", numeric: false },
            ]}
          />
        </div>
        <ul className="divide-y">
          {visible.map((r) => {
            const [figure, unit] = SEARCH_FIGURE[primary](r);
            const words = (Object.keys(SEARCH_WORDS) as SearchNum[])
              .filter((k) => k !== primary)
              .map((k) => SEARCH_WORDS[k](r))
              .join(", ");
            const rest = words.charAt(0).toUpperCase() + words.slice(1);
            return (
              <li key={r.query} className="py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium">{r.query}</p>
                  <RowFigure value={figure} unit={unit} />
                </div>
                <p className="text-xs text-muted-foreground">{SEARCH_LABEL[r.group]}</p>
                <p className="mt-1 text-xs text-muted-foreground tabular">{rest}</p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative mt-3 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th scope="col" aria-sort={ariaSort(sort, "query")} className="py-2 pr-3 text-left font-medium">
                <SortHeader label="What people searched" column="query" sort={sort} onSort={toggle} numeric={false} align="left" />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "clicks")} className="py-2 pr-3 text-right font-medium">
                <SortHeader label="Clicks" column="clicks" sort={sort} onSort={toggle} />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "impressions")} className="py-2 pr-3 text-right font-medium">
                <SortHeader label="Times shown" column="impressions" sort={sort} onSort={toggle} />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "ctr")} className="py-2 pr-3 text-right font-medium">
                <SortHeader label="Click rate" column="ctr" sort={sort} onSort={toggle} />
              </th>
              <th scope="col" aria-sort={ariaSort(sort, "position")} className="py-2 text-right font-medium">
                <SortHeader label="Position" column="position" sort={sort} onSort={toggle} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.query} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="max-w-[320px] py-2.5 pr-3">
                  <span className="block truncate font-medium" title={r.query}>
                    {r.query}
                  </span>
                  <span className="text-xs text-muted-foreground">{SEARCH_LABEL[r.group]}</span>
                </td>
                <td className="py-2.5 pr-3 text-right font-medium tabular">{formatFull(r.clicks)}</td>
                <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.impressions)}</td>
                <td className="py-2.5 pr-3 text-right tabular">{ctr(r) === null ? "—" : formatPercent(ctr(r)!)}</td>
                <td className="py-2.5 text-right tabular">{formatPosition(r.position)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No searches in this group for this period.</p>}
      <ShowMore shown={SHOWN} total={sorted.length} expanded={all} onToggle={() => setAll((v) => !v)} />
    </div>
  );
}

type CampaignCol = "name" | "sent" | "replies" | "rate" | "interested" | "bounce" | "leads" | "signups";

const RATE_INFO = "People who replied, per email the campaign sent in this period.";
const BOUNCE_INFO = "Emails that couldn't be delivered, out of the emails sent. A high share hurts how often emails land in inboxes.";

/** Instantly campaigns, sortable; rates beside the counts they come from. */
export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  const value = useCallback((r: CampaignRow, k: CampaignCol) => {
    switch (k) {
      case "name":
        return r.name;
      case "rate":
        return r.sent ? r.replies / r.sent : null;
      case "bounce":
        return r.sent ? r.bounced / r.sent : null;
      default:
        return r[k];
    }
  }, []);
  const { sorted, sort, toggle, setSort } = useSort<CampaignRow, CampaignCol>(rows, { key: "sent", dir: "desc" }, value);
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No cold email was sent in this period.</p>;
  }
  const missing = "Shows once leads are connected";
  const head = (k: CampaignCol, label: string, info?: string) => (
    <th key={k} scope="col" aria-sort={ariaSort(sort, k)} className="py-2 pr-3 text-right font-medium">
      <span className="inline-flex items-center justify-end gap-1">
        {info && <InfoTip label={label}>{info}</InfoTip>}
        <SortHeader label={label} column={k} sort={sort} onSort={toggle} />
      </span>
    </th>
  );
  const pct = (n: number | null) => (n === null ? null : formatPercent(n));
  return (
    <>
      <div className="xl:hidden">
        <div className="flex items-center justify-between gap-3 border-b pb-2.5">
          <p className="text-xs text-muted-foreground">{plural(rows.length, "campaign", "campaigns")}</p>
          <SortSelect
            sort={sort}
            onChange={setSort}
            options={[
              { key: "sent", label: "Emails sent" },
              { key: "replies", label: "Replied" },
              { key: "rate", label: "Reply rate" },
              { key: "interested", label: "Interested" },
              { key: "bounce", label: "Bounce rate" },
              { key: "leads", label: "Became leads" },
              { key: "signups", label: "Signed up" },
              { key: "name", label: "A to Z", numeric: false },
            ]}
          />
        </div>
        <ul className="divide-y">
          {sorted.map((r) => {
            const rate = pct(value(r, "rate") as number | null);
            const bounce = pct(value(r, "bounce") as number | null);
            const cell = (label: string, main: React.ReactNode, sub?: string | null, strong = false) => (
              <div className="min-w-0">
                <dt className="truncate text-muted-foreground">{label}</dt>
                <dd className={cn("tabular", strong && "font-semibold")}>
                  {main}
                  {sub && <span className="text-muted-foreground"> ({sub})</span>}
                </dd>
              </div>
            );
            return (
              <li key={r.id} className="py-3">
                <p className="truncate text-sm font-semibold">{r.name}</p>
                <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2 text-xs md:grid-cols-6 md:text-sm">
                  {cell("Emails sent", formatFull(r.sent))}
                  {cell("Replied", formatFull(r.replies), rate)}
                  {cell("Interested", formatFull(r.interested))}
                  {cell("Bounced", r.sent ? formatFull(r.bounced) : "—", r.sent ? bounce : null)}
                  {cell("Became leads", r.leads === null ? "—" : formatFull(r.leads))}
                  {cell("Signed up", r.signups === null ? "—" : formatFull(r.signups), null, true)}
                </dl>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="relative hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th scope="col" aria-sort={ariaSort(sort, "name")} className="py-2 pr-3 text-left font-medium">
                <SortHeader label="Campaign" column="name" sort={sort} onSort={toggle} numeric={false} align="left" />
              </th>
              {head("sent", "Emails sent")}
              {head("replies", "Replied")}
              {head("rate", "Reply rate", RATE_INFO)}
              {head("interested", "Interested")}
              {head("bounce", "Bounced", BOUNCE_INFO)}
              {head("leads", "Became leads")}
              <th scope="col" aria-sort={ariaSort(sort, "signups")} className="py-2 text-right font-medium">
                <SortHeader label="Signed up" column="signups" sort={sort} onSort={toggle} />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const rate = value(r, "rate") as number | null;
              const bounce = value(r, "bounce") as number | null;
              return (
                <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                  <td className="max-w-[260px] truncate py-2.5 pr-3 font-medium" title={r.name}>
                    {r.name}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.sent)}</td>
                  <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.replies)}</td>
                  <td className="py-2.5 pr-3 text-right tabular">{rate === null ? "—" : formatPercent(rate)}</td>
                  <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.interested)}</td>
                  <td className="py-2.5 pr-3 text-right tabular">
                    {r.sent ? (
                      <>
                        {formatFull(r.bounced)} <span className="text-xs text-muted-foreground">({formatPercent(bounce ?? 0)})</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular">{r.leads === null ? <NotYet title={missing} /> : formatFull(r.leads)}</td>
                  <td className="py-2.5 text-right font-medium tabular">
                    {r.signups === null ? <NotYet title={missing} /> : formatFull(r.signups)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
