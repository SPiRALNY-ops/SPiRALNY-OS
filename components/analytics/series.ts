import type { LeadSource } from "@/lib/analytics/types";

/**
 * Fixed colour per lead source (never re-assigned by rank or filter).
 * Order and values validated with the dataviz validator — see app/globals.css.
 * "Not known yet" uses the de-emphasis grey, not a categorical hue.
 */
export const SOURCE_SERIES: { key: LeadSource; label: string; color: string }[] = [
  { key: "google", label: "Google search", color: "var(--chart-1)" },
  { key: "cold_email", label: "Cold email", color: "var(--chart-2)" },
  { key: "referral", label: "Referral", color: "var(--chart-3)" },
  { key: "unknown", label: "Not known yet", color: "var(--chart-5)" },
];

export const SINGLE_SERIES_COLOR = "var(--chart-1)";
