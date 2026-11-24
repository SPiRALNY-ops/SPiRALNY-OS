import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { ConnectionsPanel } from "@/components/analytics/connections-panel";
import { AnalyticsDashboard } from "@/components/analytics/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { cacheLife } from "next/cache";
import { cachedView, viewKey } from "@/lib/analytics";
import { parseRangeKey } from "@/lib/analytics/range";
import type { RangeKey } from "@/lib/analytics/types";
import { canSee, requireUser } from "@/lib/auth/session";
import { getConnectionsStatus } from "@/lib/sync/server";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
      <header className="mb-6">
        <h1 className="brand-underline text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">Analytics</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Know what is working: where sign-ups come from and what brings them in.
        </p>
      </header>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AnalyticsContent({ searchParams }: Pick<PageProps<"/analytics">, "searchParams">) {
  const { range, google } = await searchParams;
  // The session check and the data version are independent reads, so they run together.
  const [user, key] = await Promise.all([requireUser(), viewKey(parseRangeKey(Array.isArray(range) ? range[0] : range))]);
  if (!canSee(user, "analytics")) {
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
  const dashboard = <Dashboard {...key} />;
  if (user.role !== "opslabs") return dashboard;

  // OpsLabs also sees where the numbers come from, and can connect Google or sync (rendered alongside).
  return (
    <div className="flex flex-col gap-8">
      {dashboard}
      <Connections notice={typeof google === "string" ? google : undefined} />
    </div>
  );
}

/**
 * The rendered dashboard, stored with the same key as its numbers (range, day, data version),
 * so a repeat visit sends the finished page without building or rendering anything.
 */
async function Dashboard({ rangeKey, today, version }: { rangeKey: RangeKey; today: string; version: string }) {
  "use cache";
  cacheLife({ stale: 3600, revalidate: 86_400, expire: 172_800 });
  return <AnalyticsDashboard view={await cachedView(rangeKey, today, version)} />;
}

async function Connections({ notice }: { notice?: string }) {
  return <ConnectionsPanel status={await getConnectionsStatus()} notice={notice} />;
}

function AnalyticsSkeleton() {
  // Same shape as the page: filter, sources, the charcoal sign-ups band, the number strip, two charts.
  return (
    <div className="flex flex-col gap-5" aria-label="Loading analytics" aria-busy>
      <Skeleton className="h-11 w-full max-w-sm rounded-full" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="h-56 rounded-2xl bg-[#252526] sm:h-48" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
