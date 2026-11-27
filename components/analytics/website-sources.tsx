import type { SourceDetailRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatShare } from "@/lib/format";
import { Section } from "./section";

const SHOWN = 12;

/** Where visits came from, by site: Google, ChatGPT, Instagram… with how many were engaged. */
export function WebsiteSources({ sources, total, when }: { sources: SourceDetailRow[]; total: number; when: string }) {
  const rows = sources.slice(0, SHOWN);
  const max = Math.max(0, ...rows.map((r) => r.sessions));
  const ai = sources.filter((s) => s.kind === "AI assistant").reduce((s, r) => s + r.sessions, 0);
  const social = sources.filter((s) => s.kind === "Social").reduce((s, r) => s + r.sessions, 0);
  return (
    <div id="sources" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Where visits come from"
        sample={false}
        description={
          total
            ? `${when.charAt(0).toUpperCase()}${when.slice(1)}: ${formatFull(ai)} ${ai === 1 ? "visit" : "visits"} from AI assistants and ${formatFull(social)} from social media, out of ${formatFull(total)}.`
            : "Visits to spiralny.com by the site they came from."
        }
        footer={`"Direct" is a typed address, a bookmark, an app that hides where it came from, or a link with no tag (cold-email links included); some robots land here too. Engaged: longer than 10 seconds, 2 or more pages, or a key action.`}
      >
        {rows.length ? (
          <ul className="divide-y">
            {rows.map((r) => {
              const engaged = r.sessions ? r.engaged / r.sessions : 0;
              return (
                <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 first:pt-0">
                  <span className="min-w-0">
                    <span className="font-medium">{r.label}</span>
                    {r.kind !== r.label && <span className="ml-2 text-xs text-muted-foreground">{r.kind}</span>}
                  </span>
                  <span className="text-right text-sm">
                    <span className="font-semibold tabular">{formatFull(r.sessions)}</span>
                    <span className="ml-1.5 inline-block w-11 text-right text-muted-foreground">{formatShare(total ? r.sessions / total : 0)}</span>
                  </span>
                  <div aria-hidden className="col-span-2 h-2 rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-chart-slate" style={{ width: max ? `${Math.max((r.sessions / max) * 100, r.sessions ? 1.5 : 0)}%` : 0 }} />
                  </div>
                  <span className="col-span-2 text-xs text-muted-foreground">{formatPercent(engaged, 0)} of these visits were engaged</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No visits recorded in this period.</p>
        )}
      </Section>
    </div>
  );
}
