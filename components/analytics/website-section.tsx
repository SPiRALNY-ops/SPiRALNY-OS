import { PAGE_GROUPS, type PageGroupKey } from "@/lib/analytics/groups";
import type { AnalyticsView } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { BarList } from "./bar-list";
import { SampleBadge } from "./chart-parts";
import { Section } from "./section";
import { Stat } from "./stat";

const GROUP_LABEL = Object.fromEntries(PAGE_GROUPS.map((g) => [g.key, g.label])) as Record<PageGroupKey, string>;

const longDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Google Analytics: how many people visit spiralny.com, from where, on what, and where they land. */
export function WebsiteSection({
  website,
  since,
  rangeStart,
  periodLabel,
}: {
  website: AnalyticsView["website"];
  since: string | undefined;
  rangeStart: string;
  periodLabel: string;
}) {
  const sample = website.origin === "sample";
  const engagedRate = website.sessions ? website.engaged / website.sessions : 0;
  const channelTotal = website.channels.reduce((s, c) => s + c.value, 0);
  const topChannel = website.channels[0];
  const deviceTotal = website.devices.reduce((s, d) => s + d.value, 0);
  const mobile = website.devices.find((d) => d.key.toLowerCase() === "mobile")?.value ?? 0;
  const desktop = website.devices.find((d) => d.key.toLowerCase() === "desktop")?.value ?? 0;
  const partial = !sample && since && since > rangeStart;

  return (
    <>
      <section aria-label="Website totals" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold">spiralny.com, last {periodLabel}</h3>
          {sample && <SampleBadge />}
        </div>
        {partial && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Google Analytics started recording on {longDate(since!)}, so this period only has visits from that day on.
          </p>
        )}
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
          <Stat label="Visits" value={formatFull(website.sessions)} info="Sessions: one visit to spiralny.com, however many pages it includes." />
          <Stat
            label="Engaged visits"
            value={formatPercent(engagedRate, 0)}
            sub={`${formatFull(website.engaged)} of ${formatFull(website.sessions)} visits`}
            info="Google's definition: the visit lasted more than 10 seconds, viewed 2 or more pages, or included a key event. The rest left quickly."
          />
          <Stat
            label="Most visits came from"
            value={topChannel ? topChannel.label : "—"}
            sub={topChannel && channelTotal ? `${formatPercent(topChannel.value / channelTotal, 0)} of visits` : undefined}
            info="Google Analytics' channel for each visit's first page (see the definitions under the channel list)."
          />
          <Stat
            label="On a phone"
            value={deviceTotal ? formatPercent(mobile / deviceTotal, 0) : "—"}
            sub={deviceTotal ? `${formatFull(mobile)} phone, ${formatFull(desktop)} computer visits` : undefined}
            info="The share of visits made on a phone. The rest were on a computer or tablet."
          />
        </div>
      </section>

      <Section
        title="Where visits come from"
        description={
          topChannel && channelTotal
            ? `${formatPercent(topChannel.value / channelTotal, 0)} of visits were ${topChannel.label === "Direct" ? "direct" : `from ${topChannel.label}`}.`
            : "How each visit reached spiralny.com."
        }
        sample={sample}
        footer="Direct: typed the address, a bookmark, or an app that hides where it came from. Organic Search: Google or another search engine. Organic Social: social media. Referral: a link on another site. Unassigned: Google couldn't tell."
      >
        <BarList items={website.channels} label="Visits by channel" valueSuffix={["visit", "visits"]} />
      </Section>

      <Section
        title="Where visits start"
        description="The first page of each visit, with how many of those visits were engaged."
        sample={sample}
      >
        {website.landing.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No visits recorded in this period.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                    First page
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Visits
                  </th>
                  <th scope="col" className="w-[30%] py-2 pr-4 text-left font-medium sm:pr-0">
                    Engaged
                  </th>
                </tr>
              </thead>
              <tbody>
                {website.landing.slice(0, 12).map((r) => {
                  const rate = r.sessions ? r.engaged / r.sessions : 0;
                  return (
                    <tr key={r.path} className="border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="max-w-[320px] py-2.5 pr-3 pl-4 sm:pl-0">
                        <span className="block truncate font-medium" title={r.path}>
                          {r.path}
                        </span>
                        <span className="text-xs text-muted-foreground">{GROUP_LABEL[r.group]}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-medium tabular">{formatFull(r.sessions)}</td>
                      <td className="py-2.5 pr-4 sm:pr-0">
                        <div className="flex items-center gap-2.5">
                          <div aria-hidden className="h-2 flex-1 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-chart-slate" style={{ width: `${Math.round(rate * 100)}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs tabular">{formatPercent(rate, 0)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
