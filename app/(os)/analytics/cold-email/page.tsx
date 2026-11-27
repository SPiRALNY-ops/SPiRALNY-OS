import type { Metadata } from "next";
import { AnalyticsRoute } from "../analytics-route";

export const metadata: Metadata = { title: "Analytics: Cold email" };

/** Cold email: from first email to signed agent, and how the reply rate moves. */
export default function AnalyticsColdEmailPage({ searchParams }: PageProps<"/analytics/cold-email">) {
  return <AnalyticsRoute page="cold" searchParams={searchParams} />;
}
