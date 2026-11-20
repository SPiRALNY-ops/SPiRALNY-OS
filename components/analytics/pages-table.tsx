"use client";

import { Fragment, useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PageRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition } from "@/lib/format";
import { cn } from "@/lib/utils";

function Num({ value, missing }: { value: number | null; missing: string }) {
  if (value === null)
    return (
      <span className="text-muted-foreground" title={missing}>
        —
      </span>
    );
  return <>{formatFull(value)}</>;
}

export function PagesTable({ rows }: { rows: PageRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No page data for this period yet.</p>;
  }

  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>Page on spiralny.com</TableHead>
            <TableHead className="text-right">Visits</TableHead>
            <TableHead className="text-right">Google clicks</TableHead>
            <TableHead className="text-right">Leads</TableHead>
            <TableHead className="text-right">Sign-ups</TableHead>
            <TableHead className="text-right">Visit → sign-up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const expanded = open.has(r.path);
            const rate = r.visits && r.signups !== null ? r.signups / r.visits : null;
            return (
              <Fragment key={r.path}>
                <TableRow>
                  <TableCell className="max-w-[320px]">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => toggle(r.path)}
                        aria-expanded={expanded}
                        aria-label={`${expanded ? "Hide" : "Show"} Google searches for ${r.path}`}
                        disabled={r.topSearches.length === 0}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-30"
                      >
                        <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                      </button>
                      <span className="truncate font-medium" title={r.path}>
                        {r.path}
                      </span>
                      <a
                        href={`https://spiralny.com${r.path}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${r.path} on spiralny.com`}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right">
                    <Num value={r.visits} missing="Shows once Google Analytics is connected" />
                  </TableCell>
                  <TableCell className="tabular text-right">{formatFull(r.googleClicks)}</TableCell>
                  <TableCell className="tabular text-right">
                    <Num value={r.leads} missing="Shows once form entries are connected" />
                  </TableCell>
                  <TableCell className="tabular text-right font-medium">
                    <Num value={r.signups} missing="Shows once form entries are connected" />
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">
                    {rate === null ? "—" : formatPercent(rate)}
                  </TableCell>
                </TableRow>
                {expanded && (
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={6} className="py-3 pl-9">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Google searches that led to this page</p>
                      <ul className="grid gap-1 text-sm">
                        {r.topSearches.map((s) => (
                          <li key={s.query} className="flex flex-wrap items-baseline gap-x-3">
                            <span className="min-w-0 flex-1 truncate">{s.query}</span>
                            <span className="tabular text-muted-foreground">
                              {formatFull(s.clicks)} clicks · {formatFull(s.impressions)} shown · position {formatPosition(s.position)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
