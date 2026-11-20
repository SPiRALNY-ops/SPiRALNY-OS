import { Clock3, CreditCard } from "lucide-react";
import type { AnalyticsView } from "@/lib/analytics/types";
import { KpiStrip } from "./kpi-tiles";
import { PagesTable } from "./pages-table";
import { RangeFrame } from "./range-frame";
import { SearchTrend } from "./search-trend";
import { Section } from "./section";
import { SignupsHero } from "./signups-hero";
import { CampaignsTable, SearchesTable } from "./simple-tables";
import { SourceChart } from "./source-chart";
import { SourcesBanner } from "./sources-banner";

/** A chapter of the page, headed the way spiralny.com heads its sections: bold, with the orange rule. */
function Chapter({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-6 flex flex-col gap-4 first:mt-0">
      <header>
        <h2 id={id} className="brand-underline text-xl font-bold tracking-tight">
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

export function AnalyticsDashboard({ view }: { view: AnalyticsView }) {
  const period = view.range.label.replace(/^Last /, "").toLowerCase();
  const kpi = (key: string) => view.kpis.find((k) => k.key === key)!;

  return (
    <RangeFrame current={view.range.key} aside={<>Dates in New York time</>}>
      <SourcesBanner sources={view.sources} />

      <SignupsHero
        signups={kpi("signups")}
        leads={kpi("leads")}
        buckets={view.signupsBySource.buckets}
        sample={view.signupsBySource.origin === "sample"}
        periodLabel={period}
      />

      <KpiStrip kpis={view.kpis.filter((k) => k.key !== "signups")} periodLabel={period} />

      <Chapter id="where" title="Where leads come from" intro="Each person counted once, on the day of their first form.">
        <div className="grid gap-5 xl:grid-cols-2">
          <SourceChart
            title="New leads by source"
            description="Everyone who started a sign-up form."
            buckets={view.leadsBySource.buckets}
            sample={view.leadsBySource.origin === "sample"}
            noun="leads"
          />
          <SourceChart
            title="Sign-ups by source"
            description="Forms completed with payment."
            buckets={view.signupsBySource.buckets}
            sample={view.signupsBySource.origin === "sample"}
            noun="sign-ups"
          />
        </div>
      </Chapter>

      <Chapter
        id="what"
        title="What brings them in"
        intro="The spiralny.com pages people land on, and the Google searches that bring them there."
      >
        <Section
          title="Pages that bring sign-ups"
          description="Open a page to see the Google searches behind it."
          sample={view.pages.origin === "sample"}
          footer="Google doesn't share what each visitor searched, so searches are shown per page, not per person."
        >
          <PagesTable rows={view.pages.rows} />
        </Section>

        <SearchTrend daily={view.searches.daily} sample={view.searches.origin === "sample"} />

        <Section
          title="What people searched on Google"
          description="Searches where spiralny.com appeared, by clicks."
          sample={view.searches.origin === "sample"}
        >
          <SearchesTable rows={view.searches.rows} />
        </Section>
      </Chapter>

      <Chapter
        id="cold"
        title="Cold email"
        intro="Instantly campaigns, and how many of the people emailed went on to fill the form and sign up."
      >
        <Section
          title="Campaigns"
          sample={view.coldEmail.origin === "sample"}
          footer="A form entry counts toward a campaign when its email address is in that campaign's lead list."
        >
          <CampaignsTable rows={view.coldEmail.rows} />
        </Section>
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
