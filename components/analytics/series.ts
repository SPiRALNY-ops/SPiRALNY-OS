import type { LeadSource } from "@/lib/analytics/types";

/**
 * Fixed colour per lead source (never re-assigned by rank or filter), listed in
 * stacking order. The order keeps "Not known yet" grey next to blue, not aqua:
 * the dataviz validator (light on #ffffff, dark on #1f1f20 and #252526) passes
 * colour-blind and normal-vision separation for google→referral→cold_email→unknown,
 * while aqua beside grey failed (ΔE 2.0 for deuteranopia).
 * "Not known yet" uses the de-emphasis grey, not a categorical hue.
 */
export const SOURCE_SERIES: { key: LeadSource; label: string; color: string }[] = [
  { key: "google", label: "Google search", color: "var(--chart-1)" },
  { key: "referral", label: "Referral", color: "var(--chart-3)" },
  { key: "cold_email", label: "Cold email", color: "var(--chart-2)" },
  { key: "unknown", label: "Not known yet", color: "var(--chart-5)" },
];

export const SINGLE_SERIES_COLOR = "var(--chart-1)";
