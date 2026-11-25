import { Clock3, CreditCard } from "lucide-react";
import type { AnalyticsView, KpiKey } from "@/lib/analytics/types";
import { ColdFunnel, ColdHealth, CampaignsSection, EmailSteps } from "./cold-email-section";
import { KpiStrip } from "./kpi-tiles";
import { LeadStatusCard, PlansCard } from "./leads-details";
import { PagesTable } from "./pages-table";
import { RangeFrame, type Chapter as ChapterLink } from "./range-frame";
import { PageMix, SearchMix, SearchSummary } from "./search-section";
import { SearchTrend } from "./search-trend";
import { Section } from "./section";
import { SignupsHero } from "./signups-hero";
import { SearchesTable } from "./simple-tables";
import { SourceChart } from "./source-chart";
import { SourcesBanner } from "./sources-banner";
import { WebsiteSection } from "./website-section";

const CHAPTERS: ChapterLink[] = [
  { id: "overview", label: "Overview" },
  { id: "leads", label: "Leads & sign-ups" },
  { id: "search", label: "Google search" },
  { id: "website", label: "Website" },
  { id: "cold", label: "Cold email" },
];

/** A chapter of the page, headed the way spiralny.com heads its sections: bold, with the orange rule. */
function Chapter({ id, title, intro, children }: { id: string; title: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mt-8 flex scroll-mt-32 flex-col gap-5 lg:scroll-mt-20">
      <header>
        <h2 id={`${id}-title`} className="brand-underline text-xl font-bold tracking-tight sm:text-[1.375rem]">
          {title}
        </h2>
        <p className="mt-2.5 max-w-3xl text-sm text-muted-foreground">{intro}</p>
      </header>
      {children}
    </section>
  );
}

function NotConnected({ icon: Icon, title, body, needs }: { icon: typeof Clock3; title: string; body: string; needs: string }) {
  return (
    <section className="rounded-xl border border-dashed bg-card/70 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          <p className="mt-2 text-xs font-semibold">{needs}</p>
        </div>
      </div>
    </section>
  );
}

/** "2026-11-20" -> "Nov 20" (a New York calendar day, read at UTC noon so it never shifts). */
const shortDate = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What the Pages table holds, and from when each column counts. */
function pagesDescription(view: AnalyticsView): string {
  const parts = ["The 50 pages Google sent the most people to."];
  if (view.pages.origin === "real") {
    const { ga4, forms } = view.coverage;
    if (view.website.origin === "real" && ga4 && ga4 > view.range.start)
      parts.push(`Visits count from ${shortDate(ga4)}, when Google Analytics started recording.`);
    if (forms)
      parts.push(
        `Leads and sign-ups are website form entries${forms > view.range.start ? `, counted from ${shortDate(forms)}` : ""}; the lead sheet doesn't record a page.`,
      );
  }
  parts.push("Filter by type, sort any column, and open a page to see its searches.");
  return parts.join(" ");
}

export function AnalyticsDashboard({ view }: { view: AnalyticsView }) {
  const period = view.range.label.replace(/^Last /, "").toLowerCase();
  const kpi = (key: KpiKey) => view.kpis.find((k) => k.key === key)!;
  const sum = (buckets: AnalyticsView["leadsBySource"]["buckets"], key: "cold_email") => buckets.reduce((s, b) => s + b[key], 0);

  return (
    <RangeFrame current={view.range.key} chapters={CHAPTERS}>
      <section id="overview" aria-label="Overview" className="flex scroll-mt-32 flex-col gap-5 lg:scroll-mt-20">
        <SourcesBanner sources={view.sources} />
        <SignupsHero
          signups={kpi("signups")}
          leads={kpi("leads")}
          buckets={view.signupsBySource.buckets}
          sample={view.signupsBySource.origin === "sample"}
          periodLabel={period}
        />
        <KpiStrip kpis={view.kpis.filter((k) => k.key !== "signups")} periodLabel={period} />
      </section>

      <Chapter
        id="leads"
        title="Leads & sign-ups"
        intro="Everyone who came in from the forms or the lead sheet, each person counted once, on the day they first appeared."
      >
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
        <LeadStatusCard status={view.leadStatus} />
      </Chapter>

      <Chapter
        id="search"
        title="Google search"
        intro="How often spiralny.com shows up in Google, what people searched for, and which pages they landed on. From Search Console, which reports with a 2 to 3 day delay."
      >
        <SearchSummary search={view.searches} periodLabel={period} />
        <SearchTrend
          daily={view.searches.daily}
          sample={view.searches.origin === "sample"}
          rangeEnd={view.range.end}
          buckets={view.range.buckets}
          bucketSize={view.range.bucketSize}
        />
        <SearchMix search={view.searches} />
        <PageMix pages={view.pages} siteClicks={view.searches.totals.clicks} />
        <Section
          title="Pages"
          description={pagesDescription(view)}
          sample={view.pages.origin === "sample"}
          footer="Google doesn't share what each visitor searched, so searches are shown per page, not per person."
        >
          <PagesTable rows={view.pages.rows} />
        </Section>
        <Section
          title="Searches"
          description="The top 40 searches in each group: how often each showed spiralny.com, was clicked, and where the site ranked."
          sample={view.searches.origin === "sample"}
        >
          <SearchesTable rows={view.searches.rows} />
        </Section>
      </Chapter>

      <Chapter
        id="website"
        title="Website"
        intro="Visits to spiralny.com from Google Analytics: how people arrive, on which device, and where they start."
      >
        <WebsiteSection website={view.website} since={view.coverage.ga4} rangeStart={view.range.start} periodLabel={period} />
      </Chapter>

      <Chapter
        id="cold"
        title="Cold email"
        intro="Instantly campaigns, from the first email to a signed agent: who replied, which email works best, and how cleanly the emails are delivered."
      >
        <ColdFunnel
          cold={view.coldEmail}
          leads={sum(view.leadsBySource.buckets, "cold_email")}
          signups={sum(view.signupsBySource.buckets, "cold_email")}
          periodLabel={period}
        />
        <ColdHealth cold={view.coldEmail} />
        <EmailSteps cold={view.coldEmail} />
        <CampaignsSection cold={view.coldEmail} />
      </Chapter>

      <Chapter id="later" title="Coming with other tools" intro="Two more answers from the plan, once their data exists.">
        <div className="grid gap-5 md:grid-cols-2">
          <NotConnected
            icon={Clock3}
            title="How fast leads hear back"
            body="Time from a form being filled to the first call, text or email."
            needs="Comes with the Leads tab (Step 1)."
          />
          <NotConnected
            icon={CreditCard}
            title="Time to pay, plans and net agents"
            body="How long from form to first payment, agents per plan each month, and the forecast to 200 and 300 agents."
            needs="Needs Stripe to be connected."
          />
        </div>
      </Chapter>
    </RangeFrame>
  );
}
