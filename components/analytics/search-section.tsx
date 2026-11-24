import type { AnalyticsView } from "@/lib/analytics/types";
import { formatFull, formatPercent, formatPosition } from "@/lib/format";
import { SampleBadge } from "./chart-parts";
import { GroupTable } from "./group-table";
import { Section } from "./section";
import { Change, STAT_GRID, Stat } from "./stat";

type Search = AnalyticsView["searches"];

/** Search Console's four headline numbers, each against the period before. */
export function SearchSummary({ search, periodLabel }: { search: Search; periodLabel: string }) {
  const t = search.totals;
  const p = search.previous;
  return (
    <section aria-label="Google search totals" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">Google search, last {periodLabel}</h3>
        {search.origin === "sample" && <SampleBadge />}
      </div>
      <div className={STAT_GRID}>
        <Stat
          label="Clicks"
          value={formatFull(t.clicks)}
          info="Times someone clicked through to spiralny.com from Google search results."
          change={<Change value={t.clicks} previous={p?.clicks ?? null} previousText={p ? `vs ${formatFull(p.clicks)}` : undefined} />}
        />
        <Stat
          label="Times shown"
          value={formatFull(t.impressions)}
          info="Impressions: how often a spiralny.com page appeared in someone's Google results, whether or not they scrolled to it."
          change={<Change value={t.impressions} previous={p?.impressions ?? null} previousText={p ? `vs ${formatFull(p.impressions)}` : undefined} />}
        />
        <Stat
          label="Click rate"
          value={formatPercent(t.ctr)}
          info="Clicks divided by times shown (CTR). Higher means the page title and description won the click more often."
          change={<Change value={t.ctr} previous={p?.ctr ?? null} absolute previousText={p ? `vs ${formatPercent(p.ctr)}` : undefined} />}
        />
        <Stat
          label="Average position"
          value={formatPosition(t.position)}
          info="Where spiralny.com usually sat in the results: 1 is the top. Lower is better; positions 1–10 are page one."
          change={
            <Change
              value={t.position}
              previous={p?.position ?? null}
              goodWhen="down"
              places
              previousText={p ? `vs ${formatPosition(p.position)}` : undefined}
            />
          }
        />
      </div>
    </section>
  );
}

/** What kind of searches bring people, using the plain rules in lib/analytics/groups.ts. */
export function SearchMix({ search }: { search: Search }) {
  const g = Object.fromEntries(search.groups.map((r) => [r.key, r]));
  const grouped = search.groups.reduce((s, r) => s + r.clicks, 0);
  const brandShare = grouped ? g.brand.clicks / grouped : 0;
  const rec = g.recruiting;
  return (
    <Section
      title="What people searched for"
      description={
        grouped
          ? `${formatPercent(brandShare, 0)} of clicks came from people already searching for Spiral. Brokerage and license searches showed spiralny.com ${formatFull(rec.impressions)} times and brought ${formatFull(rec.clicks)} clicks.`
          : "Searches sorted into three groups."
      }
      sample={search.origin === "sample"}
      footer={`Google keeps rare searches private, so these groups add up to ${formatFull(grouped)} of the ${formatFull(search.totals.clicks)} clicks above.`}
    >
      <GroupTable rows={search.groups} label="Clicks by type of search" itemNoun={["search", "searches"]} />
    </Section>
  );
}

/** Which kinds of pages Google sends people to. */
export function PageMix({ pages, siteClicks }: { pages: AnalyticsView["pages"]; siteClicks: number }) {
  const g = Object.fromEntries(pages.groups.map((r) => [r.key, r]));
  const total = pages.groups.reduce((s, r) => s + r.clicks, 0);
  return (
    <Section
      title="Which pages Google sends people to"
      description={
        total
          ? `Recruiting pages got ${formatFull(g.recruiting.clicks)} of ${formatFull(total)} clicks; the home page ${formatFull(g.home.clicks)} and agent profiles ${formatFull(g.agents.clicks)}.`
          : "Pages sorted into groups."
      }
      sample={pages.origin === "sample"}
      footer={
        total > siteClicks
          ? `Counted page by page: when one search showed two spiralny.com pages, both count, so this adds up to ${formatFull(total)} rather than the ${formatFull(siteClicks)} clicks above.`
          : undefined
      }
    >
      <GroupTable rows={pages.groups} label="Clicks by type of page" itemNoun={["page", "pages"]} />
    </Section>
  );
}
