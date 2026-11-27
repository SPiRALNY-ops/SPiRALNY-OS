import type { Metadata } from "next";
import { AnalyticsRoute } from "../analytics-route";

export const metadata: Metadata = { title: "Analytics: Leads & sign-ups" };

/** Leads & sign-ups: where they come from, how they turn out, and the state of the lead sheet. */
export default function AnalyticsLeadsPage({ searchParams }: PageProps<"/analytics/leads">) {
  return <AnalyticsRoute page="leads" searchParams={searchParams} />;
}
