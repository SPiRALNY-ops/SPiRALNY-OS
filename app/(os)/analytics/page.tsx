import type { Metadata } from "next";
import { AnalyticsRoute } from "./analytics-route";

export const metadata: Metadata = { title: "Analytics" };

/** The Overview: sign-ups, the key numbers, what stands out, and the way into each area. */
export default function AnalyticsOverviewPage({ searchParams }: PageProps<"/analytics">) {
  return <AnalyticsRoute page="overview" searchParams={searchParams} />;
}
