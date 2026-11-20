import type { Metadata } from "next";
import { Suspense } from "react";
import { Lock } from "lucide-react";
import { AnalyticsDashboard } from "@/components/analytics/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { getAnalytics } from "@/lib/analytics";
import { parseRangeKey } from "@/lib/analytics/range";
import { canSee, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1 text-muted-foreground">Know what is working: where sign-ups come from and what brings them in.</p>
      </header>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function AnalyticsContent({ searchParams }: Pick<PageProps<"/analytics">, "searchParams">) {
  const user = await requireUser();
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
  const { range } = await searchParams;
  const view = await getAnalytics(parseRangeKey(Array.isArray(range) ? range[0] : range));
  return <AnalyticsDashboard view={view} />;
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading analytics">
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
