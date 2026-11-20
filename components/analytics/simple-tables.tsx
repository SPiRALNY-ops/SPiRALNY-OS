import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { CampaignRow, SearchRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition } from "@/lib/format";
import { NotYet } from "./section";

export function SearchesTable({ rows }: { rows: SearchRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No searches recorded for this period yet.</p>;
  }
  return (
    <div className="-mx-4 max-h-[420px] overflow-auto sm:mx-0">
      <Table className="min-w-[480px]">
        <TableHeader>
          <TableRow>
            <TableHead>What people searched</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Times shown</TableHead>
            <TableHead className="text-right">Avg. position</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 20).map((r) => (
            <TableRow key={r.query}>
              <TableCell className="max-w-[280px] truncate" title={r.query}>
                {r.query}
              </TableCell>
              <TableCell className="tabular text-right font-medium">{formatFull(r.clicks)}</TableCell>
              <TableCell className="tabular text-right">{formatFull(r.impressions)}</TableCell>
              <TableCell className="tabular text-right">{formatPosition(r.position)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CampaignsTable({ rows }: { rows: CampaignRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No cold email was sent in this period.</p>;
  }
  const missing = "Shows once form entries are connected";
  return (
    <div className="-mx-4 overflow-x-auto sm:mx-0">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            <TableHead>Campaign</TableHead>
            <TableHead className="text-right">Emails sent</TableHead>
            <TableHead className="text-right">Replies</TableHead>
            <TableHead className="text-right">Reply rate</TableHead>
            <TableHead className="text-right">Interested</TableHead>
            <TableHead className="text-right">Filled the form</TableHead>
            <TableHead className="text-right">Signed up</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[260px] truncate font-medium" title={r.name}>
                {r.name}
              </TableCell>
              <TableCell className="tabular text-right">{formatFull(r.sent)}</TableCell>
              <TableCell className="tabular text-right">{formatFull(r.replies)}</TableCell>
              <TableCell className="tabular text-right text-muted-foreground">
                {r.sent ? formatPercent(r.replies / r.sent) : "—"}
              </TableCell>
              <TableCell className="tabular text-right">{formatFull(r.interested)}</TableCell>
              <TableCell className="tabular text-right">
                {r.leads === null ? <NotYet title={missing} /> : formatFull(r.leads)}
              </TableCell>
              <TableCell className="tabular text-right font-medium">
                {r.signups === null ? <NotYet title={missing} /> : formatFull(r.signups)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
