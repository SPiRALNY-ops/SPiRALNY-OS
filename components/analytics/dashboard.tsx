import { shortDate } from "@/lib/analytics/range";
import type { Finding } from "@/lib/analytics/insights";
import type { AnalyticsView, KpiKey, LongView } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { ColdFunnel, ColdHealth, CampaignsSection, EmailSteps } from "./cold-email-section";
import { Findings } from "./findings";
import { KpiStrip } from "./kpi-tiles";
import { FollowUpBacklog, LeadOutcomes, Onboarding, SheetHealth, SignupsByMonth } from "./leads-deep";
import { PlansCard } from "./leads-details";
import { PagesTable } from "./pages-table";
import { RangeFrame } from "./range-frame";
import { CompetingPages, Movers, Opportunities, RecruitingPagesTrend } from "./search-deep";
import { PageMix, SearchMix, SearchSummary } from "./search-section";
import { SearchTrend } from "./search-trend";
import { Section } from "./section";
import { SignupsHero } from "./signups-hero";
import { SearchesTable } from "./simple-tables";
import { SourceChart } from "./source-chart";
import { SourcesBanner } from "./sources-banner";
import { MonthlyBarsCard, ReplyRateCard, StackCard } from "./trend-cards";
import { WebsiteSection } from "./website-section";
import { WebsiteSources } from "./website-sources";

type PageProps = { view: AnalyticsView; long: LongView; findings: Finding[] };

const periodOf = (view: AnalyticsView) => view.range.label.replace(/^Last /, "").toLowerCase();
const kpiOf = (view: AnalyticsView, key: KpiKey) => view.kpis.find((k) => k.key === key)!;

/** A chapter of a page, headed the way spiralny.com heads its sections: bold, with the orange rule. */
function Chapter({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-4 flex scroll-mt-32 flex-col gap-5 lg:scroll-mt-20">
      <header>
        <h2 id={`${id}-title`} className="brand-underline text-xl font-bold tracking-tight sm:text-[1.375rem]">
          {title}
        </h2>
        {intro && <p className="mt-2.5 max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </header>
      {children}
    </section>
  );
}

/** Where a section's numbers will come from, when its source isn't connected yet (no made-up numbers). */
function NotConnectedYet({ what }: { what: string }) {
  return <p className="rounded-xl border border-dashed bg-card/70 p-4 text-sm text-muted-foreground">Shows once {what} is connected.</p>;
}

/** The Overview: the one question (where sign-ups come from), the key numbers, and what stands out. The tabs lead on. */
export function OverviewPage({ view, findings }: PageProps) {
  const period = periodOf(view);
  return (
    <RangeFrame current={view.range.key}>
      <SourcesBanner sources={view.sources} />
      <SignupsHero
        signups={kpiOf(view, "signups")}
        leads={kpiOf(view, "leads")}
        buckets={view.signupsBySource.buckets}
        sample={view.signupsBySource.origin === "sample"}
        periodLabel={period}
      />
      <KpiStrip kpis={view.kpis.filter((k) => k.key !== "signups")} periodLabel={period} />
      <Findings items={findings} range={view.range.key} empty="Nothing stands out in this period." />
    </RangeFrame>
  );
}

export function LeadsPage({ view, long, findings }: PageProps) {
  const period = periodOf(view);
  return (
    <RangeFrame current={view.range.key}>
      <Findings items={findings} range={view.range.key} />
      <Chapter id="sources" title="This period" intro={`Everyone who came in from the forms or the lead sheet in the last ${period}, each person counted once, on the day they first appeared.`}>
        <div className="grid gap-5 xl:grid-cols-2">
          <SourceChart
            title="New leads by source"
            description="Everyone who started a sign-up form or was added to the lead sheet."
            buckets={view.leadsBySource.buckets}
            sample={view.leadsBySource.origin === "sample"}
            noun="leads"
          />
          <SourceChart
            title="Sign-ups by source"
            description="Agents who completed a sign-up or were added to the SIGNED! tab."
            buckets={view.signupsBySource.buckets}
            sample={view.signupsBySource.origin === "sample"}
            noun="sign-ups"
          />
        </div>
        <PlansCard plans={view.plans} periodLabel={period} />
      </Chapter>
      <Chapter id="over-time" title="Over time" intro="The whole history on record. The period picker doesn't change this part.">
        {long.leads ? (
          <>
            <SignupsByMonth leads={long.leads} />
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <LeadOutcomes leads={long.leads} />
              <FollowUpBacklog leads={long.leads} />
            </div>
          </>
        ) : (
          <NotConnectedYet what="the lead sheet" />
        )}
      </Chapter>
      {long.leads && (
        <Chapter id="today" title="New agents and the sheet" intro="How onboarding stands today, and what's missing on the lead sheet.">
          <Onboarding leads={long.leads} />
          <SheetHealth leads={long.leads} />
        </Chapter>
      )}
    </RangeFrame>
  );
}

/** Colours for the search groups, in a validated stacking order (recruiting → brand → everything else). */
const GROUP_SERIES = [
  { key: "recruiting", label: "Brokerage, commission & license", color: "var(--chart-1)" },
  { key: "brand", label: "Searching for Spiral", color: "var(--chart-2)" },
  { key: "other", label: "Everything else", color: "var(--chart-5)" },
] as const;

export function SearchPage({ view, long, findings }: PageProps) {
  const period = periodOf(view);
  const s = view.searches;
  const deep = s.origin === "real" ? s.deep : null;
  return (
    <RangeFrame current={view.range.key}>
      <Findings items={findings} range={view.range.key} />
      <SearchSummary search={s} periodLabel={period} />
      {deep ? (
        <>
          <Opportunities deep={deep} periodLabel={period} />
          <Movers deep={deep} periodLabel={period} />
        </>
      ) : (
        <NotConnectedYet what="Search Console" />
      )}
      <SearchTrend daily={s.daily} sample={s.origin === "sample"} rangeEnd={view.range.end} buckets={view.range.buckets} bucketSize={view.range.bucketSize} />

      <Chapter id="long-term" title="Over 16 months" intro="Everything Search Console keeps. The period picker doesn't change this part.">
        {long.search ? (
          <>
            <MonthlyBarsCard
              id="by-month"
              title="Google, month by month"
              description="Clicks and times shown for every month Search Console keeps."
              footer={'Months marked "so far" aren\'t over (Search Console runs 2 to 3 days behind).'}
              months={long.search.months}
              measures={[
                { key: "clicks", label: "Clicks", values: long.search.clicks },
                { key: "impressions", label: "Times shown", values: long.search.impressions },
              ]}
            />
            <StackCard
              id="groups-by-month"
              title="Who clicks: by kind of search, month by month"
              description={groupsFinding(long.search)}
              footer={`Google names the search behind only part of the clicks (${Math.round(long.search.namedShare * 100)}% over 16 months; it hides rare searches), so these add up to less than the chart above.`}
              months={long.search.months}
              series={GROUP_SERIES.map((g) => ({ ...g, values: long.search!.groups[g.key] }))}
              noun="named clicks"
            />
            <RecruitingPagesTrend search={long.search} />
          </>
        ) : (
          <NotConnectedYet what="Search Console" />
        )}
      </Chapter>

      <Chapter id="detail" title={`Searches and pages, last ${period}`} intro="What people searched for, which pages Google sent them to, and where your own pages compete. Tap any search or page for its detail.">
        <SearchMix search={s} />
        <PageMix pages={view.pages} siteClicks={s.totals.clicks} />
        {deep && <CompetingPages deep={deep} periodLabel={period} />}
        <Section
          title="Pages"
          description={pagesDescription(view)}
          sample={view.pages.origin === "sample"}
          footer="Google doesn't share what each visitor searched, so searches are shown per page, not per person."
        >
          <PagesTable rows={view.pages.rows} />
        </Section>
        <Section title="Searches" description="The top 40 searches in each group: how often each showed spiralny.com, was clicked, and where the site ranked." sample={s.origin === "sample"}>
          <SearchesTable rows={s.rows} />
        </Section>
      </Chapter>
    </RangeFrame>
  );
}

/** The 16-month search mix in one sentence: who the clicks come from. */
function groupsFinding(search: NonNullable<LongView["search"]>): string {
  const total = (k: "brand" | "recruiting" | "other") => search.groups[k].reduce((s, n) => s + n, 0);
  const brand = total("brand");
  const recruiting = total("recruiting");
  return `Over 16 months, people already searching for Spiral brought ${formatFull(brand)} clicks; agents searching for a brokerage, commission or license brought ${formatFull(recruiting)}. That second group is the one that finds new agents.`;
}

/** The reply rate's latest complete month against its best of the six before, in one sentence. */
function replyFinding(cold: NonNullable<LongView["cold"]>): string {
  const full = cold.months.filter((m) => !m.partial && m.sent > 0);
  const last = full.at(-1);
  const best = full.slice(-7, -1).sort((a, b) => b.replies / b.sent - a.replies / a.sent)[0];
  if (!last) return "Replies for each email sent, all campaigns together.";
  const rate = (m: { replies: number; sent: number }) => formatPercent(m.replies / m.sent, 1);
  if (!best) return `${rate(last)} of emails got a reply in ${last.label}, all campaigns together.`;
  return best.replies / best.sent > last.replies / last.sent
    ? `${rate(last)} of emails got a reply in ${last.label}, down from ${rate(best)} in ${best.label}. All campaigns together; the period picker doesn't change this.`
    : `${rate(last)} of emails got a reply in ${last.label}, the best month recently. All campaigns together.`;
}

/** What the Pages table holds, and from when each column counts. */
function pagesDescription(view: AnalyticsView): string {
  const parts = ["The 50 pages Google sent the most people to."];
  if (view.pages.origin === "real") {
    const { ga4, forms } = view.coverage;
    if (view.website.origin === "real" && ga4 && ga4 > view.range.start) parts.push(`Visits count from ${shortDate(ga4)}, when Google Analytics started recording.`);
    if (forms) parts.push(`Leads and sign-ups are website form entries${forms > view.range.start ? `, counted from ${shortDate(forms)}` : ""}; the lead sheet doesn't record a page.`);
  }
  parts.push("Filter by type, sort any column, and open a page to see its searches.");
  return parts.join(" ");
}

export function WebsitePage({ view, findings }: PageProps) {
  const period = periodOf(view);
  return (
    <RangeFrame current={view.range.key}>
      <Findings items={findings} range={view.range.key} />
      <WebsiteSection
        website={view.website}
        since={view.coverage.ga4}
        rangeStart={view.range.start}
        periodLabel={period}
        sources={view.website.origin === "real" ? <WebsiteSources sources={view.website.sources} total={view.website.sessions} periodLabel={period} /> : undefined}
      />
    </RangeFrame>
  );
}

export function ColdEmailPage({ view, long, findings }: PageProps) {
  const period = periodOf(view);
  const sum = (key: "cold_email") => (buckets: AnalyticsView["leadsBySource"]["buckets"]) => buckets.reduce((s, b) => s + b[key], 0);
  return (
    <RangeFrame current={view.range.key}>
      <Findings items={findings} range={view.range.key} />
      <ColdFunnel cold={view.coldEmail} leads={sum("cold_email")(view.leadsBySource.buckets)} signups={sum("cold_email")(view.signupsBySource.buckets)} periodLabel={period} />
      {long.cold ? (
        <ReplyRateCard
          id="trend"
          title="Reply rate over time"
          description={replyFinding(long.cold)}
          footer={'Each day\'s replies as Instantly counts them (people who replied that day), divided by emails sent. Periods marked "so far" aren\'t over.'}
          months={long.cold.months}
          weeks={long.cold.weeks.map((w) => ({ ...w, label: shortDate(w.key) }))}
        />
      ) : (
        <NotConnectedYet what="Instantly" />
      )}
      <div id="sending" className="scroll-mt-32 lg:scroll-mt-20">
        <ColdHealth cold={view.coldEmail} />
      </div>
      <EmailSteps cold={view.coldEmail} />
      <CampaignsSection cold={view.coldEmail} />
    </RangeFrame>
  );
}
