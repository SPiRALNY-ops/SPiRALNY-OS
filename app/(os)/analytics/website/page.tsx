import type { Metadata } from "next";
import { AnalyticsRoute } from "../analytics-route";

export const metadata: Metadata = { title: "Analytics: Website" };

/** Website: where visits come from and where they start. */
export default function AnalyticsWebsitePage({ searchParams }: PageProps<"/analytics/website">) {
  return <AnalyticsRoute page="website" searchParams={searchParams} />;
}
