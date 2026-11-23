"use client";

import { useCallback, useMemo, useState } from "react";
import { SEARCH_GROUPS, type SearchGroupKey } from "@/lib/analytics/groups";
import type { CampaignRow, SearchRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition } from "@/lib/format";
import { InfoTip } from "./info-tip";
import { NotYet } from "./section";
import { FilterChips, ShowMore, SortHeader, ariaSort, useSort } from "./table-tools";

const SEARCH_LABEL = Object.fromEntries(SEARCH_GROUPS.map((g) => [g.key, g.label])) as Record<SearchGroupKey, string>;

type SearchCol = "query" | "clicks" | "impressions" | "ctr" | "position";

/** The searches that showed spiralny.com, filterable by group and sortable by any column. */
export function SearchesTable({ rows }: { rows: SearchRow[] }) {
  const [group, setGroup] = useState<SearchGroupKey | "all">("all");
  const [all, setAll] = useState(false);
  const filtered = useMemo(() => (group === "all" ? rows : rows.filter((r) => r.group === group)), [rows, group]);
  const value = useCallback((r: SearchRow, k: SearchCol) => {
    if (k === "query") return r.query;
    if (k === "ctr") return r.impressions ? r.clicks / r.impressions : null;
    return r[k];
  }, []);
  const { sorted, sort, toggle } = useSort<SearchRow, SearchCol>(filtered, { key: "clicks", dir: "desc" }, value);
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

  return (
    <div>
      <FilterChips label="Filter searches" options={options} value={group} onChange={(k) => { setGroup(k); setAll(false); }} />
      <div className="-mx-4 mt-3 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b text-xs">
              <th scope="col" aria-sort={ariaSort(sort, "query")} className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
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
              <th scope="col" aria-sort={ariaSort(sort, "position")} className="py-2 pr-4 text-right font-medium sm:pr-0">
                <SortHeader label="Position" column="position" sort={sort} onSort={toggle} />
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.query} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                <td className="max-w-[320px] py-2.5 pr-3 pl-4 sm:pl-0">
                  <span className="block truncate font-medium" title={r.query}>
                    {r.query}
                  </span>
                  <span className="text-xs text-muted-foreground">{SEARCH_LABEL[r.group]}</span>
                </td>
                <td className="py-2.5 pr-3 text-right font-medium tabular">{formatFull(r.clicks)}</td>
                <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.impressions)}</td>
                <td className="py-2.5 pr-3 text-right tabular">{r.impressions ? formatPercent(r.clicks / r.impressions) : "—"}</td>
                <td className="py-2.5 pr-4 text-right tabular sm:pr-0">{formatPosition(r.position)}</td>
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
  const { sorted, sort, toggle } = useSort<CampaignRow, CampaignCol>(rows, { key: "sent", dir: "desc" }, value);
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
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b text-xs">
            <th scope="col" aria-sort={ariaSort(sort, "name")} className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
              <SortHeader label="Campaign" column="name" sort={sort} onSort={toggle} numeric={false} align="left" />
            </th>
            {head("sent", "Emails sent")}
            {head("replies", "Replied")}
            {head("rate", "Reply rate", "People who replied, per email the campaign sent in this period.")}
            {head("interested", "Interested")}
            {head(
              "bounce",
              "Bounced",
              "Emails that couldn't be delivered, out of the emails sent. A high share hurts how often emails land in inboxes.",
            )}
            {head("leads", "Became leads")}
            <th scope="col" aria-sort={ariaSort(sort, "signups")} className="py-2 pr-4 text-right font-medium sm:pr-0">
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
                <td className="max-w-[260px] truncate py-2.5 pr-3 pl-4 font-medium sm:pl-0" title={r.name}>
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
                <td className="py-2.5 pr-4 text-right font-medium tabular sm:pr-0">
                  {r.signups === null ? <NotYet title={missing} /> : formatFull(r.signups)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
