import type { GroupRow } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { InfoTip } from "./info-tip";

/**
 * Groups of searches or pages: clicks as a one-hue bar (the figure that ranks
 * them), with times shown and click rate beside. Every figure is printed.
 */
export function GroupTable<K extends string>({
  rows,
  label,
  itemNoun,
}: {
  rows: GroupRow<K>[];
  label: string;
  itemNoun: [string, string]; // ["search", "searches"]
}) {
  const maxClicks = Math.max(...rows.map((r) => r.clicks), 0);
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table aria-label={label} className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              Group
            </th>
            <th scope="col" className="w-[38%] py-2 pr-3 font-medium">
              Clicks
            </th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">
              Times shown
            </th>
            <th scope="col" className="py-2 text-right font-medium">
              Click rate
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <th scope="row" className="py-3 pr-3 text-left align-top font-normal">
                <span className="flex items-center gap-1.5 font-medium">
                  {r.label}
                  <InfoTip label={r.label}>{r.rule}</InfoTip>
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatFull(r.items)} {r.items === 1 ? itemNoun[0] : itemNoun[1]}
                </span>
              </th>
              <td className="py-3 pr-3 align-top">
                <div className="flex items-center gap-2.5">
                  <div aria-hidden className="h-2 flex-1 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-chart-slate"
                      style={{ width: maxClicks ? `${Math.max((r.clicks / maxClicks) * 100, r.clicks ? 1.5 : 0)}%` : 0 }}
                    />
                  </div>
                  <span className="w-12 text-right font-semibold tabular">{formatFull(r.clicks)}</span>
                  <span className="w-9 text-right text-xs text-muted-foreground tabular">
                    {totalClicks ? formatPercent(r.clicks / totalClicks, 0) : "—"}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-3 text-right align-top tabular">{formatFull(r.impressions)}</td>
              <td className="py-3 text-right align-top tabular">{r.impressions ? formatPercent(r.clicks / r.impressions) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
