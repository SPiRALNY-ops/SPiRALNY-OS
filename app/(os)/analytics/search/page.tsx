import type { Metadata } from "next";
import { AnalyticsRoute } from "../analytics-route";

export const metadata: Metadata = { title: "Analytics: Google search" };

/** Google search: what people search, where spiralny.com ranks, and what is close to page one. */
export default function AnalyticsSearchPage({ searchParams }: PageProps<"/analytics/search">) {
  return <AnalyticsRoute page="search" searchParams={searchParams} />;
}
