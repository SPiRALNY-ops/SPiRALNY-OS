import { Suspense } from "react";
import { cacheLife } from "next/cache";
import { Lock } from "lucide-react";
import { ConnectionsPanel } from "@/components/analytics/connections-panel";
import { ColdEmailPage, LeadsPage, OverviewPage, SearchPage, WebsitePage } from "@/components/analytics/dashboard";
import { DetailPanel } from "@/components/analytics/detail-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { cachedLong, cachedView } from "@/lib/analytics";
import { analyticsPage } from "@/lib/analytics/access";
import { findings, topFindings, type Area } from "@/lib/analytics/insights";
import type { RangeKey } from "@/lib/analytics/types";
import { getConnectionsStatus } from "@/lib/sync/server";

export type AnalyticsPageKey = "overview" | Area;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Everything an Analytics page does around its own content: check who's asking, read the period,
 * serve the page from the day's cache, and mount the detail panel. The Overview also carries
 * OpsLabs' connections panel (Google connect returns there).
 */
export function AnalyticsRoute({ page, searchParams }: { page: AnalyticsPageKey; searchParams: SearchParams }) {
  return (
    <>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <Content page={page} searchParams={searchParams} />
      </Suspense>
      {/* Reads ?item from the address, so it sits in its own Suspense boundary. */}
      <Suspense fallback={null}>
        <DetailPanel />
      </Suspense>
    </>
  );
}

async function Content({ page, searchParams }: { page: AnalyticsPageKey; searchParams: SearchParams }) {
  const { user, allowed, key } = await analyticsPage(searchParams);
  if (!allowed) {
    return (
      <div className="flex items-start gap-3 rounded-xl border bg-card p-5">
        <Lock aria-hidden className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <p className="font-semibold">Analytics is for Marcel.</p>
          <p className="mt-1 text-sm text-muted-foreground">Ask Marcel or OpsLabs if you need access.</p>
        </div>
      </div>
    );
  }
  const body = <Rendered page={page} rangeKey={key.rangeKey} today={key.today} version={key.version} />;
  if (page !== "overview" || user.role !== "opslabs") return body;
  // OpsLabs also sees where the numbers come from, and can connect Google or sync.
  const { google } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      {body}
      <Connections notice={typeof google === "string" ? google : undefined} />
    </div>
  );
}

/**
 * The page, rendered and stored with the same key as its numbers (page, range, day, data version),
 * so a repeat visit is sent without building or rendering anything.
 */
async function Rendered({ page, rangeKey, today, version }: { page: AnalyticsPageKey; rangeKey: RangeKey; today: string; version: string }) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 108_000 });
  const [view, long] = await Promise.all([cachedView(rangeKey, today, version), cachedLong(today, version)]);
  const all = findings(view, long);
  const props = { view, long };
  switch (page) {
    case "overview":
      return <OverviewPage {...props} findings={topFindings(all)} />;
    case "leads":
      return <LeadsPage {...props} findings={all.filter((f) => f.area === "leads")} />;
    case "search":
      return <SearchPage {...props} findings={all.filter((f) => f.area === "search")} />;
    case "website":
      return <WebsitePage {...props} findings={all.filter((f) => f.area === "website")} />;
    case "cold":
      return <ColdEmailPage {...props} findings={all.filter((f) => f.area === "cold")} />;
  }
}

async function Connections({ notice }: { notice?: string }) {
  return <ConnectionsPanel status={await getConnectionsStatus()} notice={notice} />;
}

function AnalyticsSkeleton() {
  // Same shape as a page: the control row, a first panel, then sections.
  return (
    <div className="flex flex-col gap-5" aria-label="Loading analytics" aria-busy>
      <Skeleton className="h-11 w-full rounded-full" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="h-48 rounded-2xl bg-[#252526] sm:h-44" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
