import type { AnalyticsView } from "@/lib/analytics/types";
import { formatFull, listOf } from "@/lib/format";
import { BarList } from "./bar-list";
import { Section } from "./section";

export function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular">{formatFull(n)}</span>;
}

/** The plans with the highest count (ties included, "Not stated" left out). */
function leaders(rows: { label: string; value: number; key: string }[]): string[] {
  const known = rows.filter((r) => r.key !== "none" && r.value > 0);
  const max = Math.max(0, ...known.map((r) => r.value));
  return known.filter((r) => r.value === max).map((r) => r.label);
}

/** Which plans agents chose, and which plans leads asked about. */
export function PlansCard({ plans, periodLabel }: { plans: AnalyticsView["plans"]; periodLabel: string }) {
  const joined = plans.joined.reduce((s, r) => s + r.value, 0);
  const asked = plans.asked.reduce((s, r) => s + r.value, 0);
  const topJoined = leaders(plans.joined);
  const topAsked = leaders(plans.asked);
  const chose = topJoined.length
    ? topJoined.length === 1
      ? `${topJoined[0]} is the plan most agents chose in the last ${periodLabel}`
      : `${listOf(topJoined)} were chosen equally often in the last ${periodLabel}`
    : "";
  const askedAbout = topAsked.length
    ? topAsked.length === 1
      ? `leads asked most about ${topAsked[0]}`
      : `leads asked equally about ${listOf(topAsked)}`
    : "";
  const finding = [chose, askedAbout].filter(Boolean).join("; ");
  return (
    <Section
      title="Plans"
      description={
        finding
          ? `${finding.charAt(0).toUpperCase()}${finding.slice(1)}.`
          : "Which plan agents joined on, and which plan leads asked about."
      }
      sample={plans.origin === "sample"}
      footer="From the sign-up forms and the lead sheet (SIGNED! status, and “Inquiring about?” on the lead tabs). Each person is counted once per plan."
    >
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold">
            Agents who joined <Count n={joined} />
          </h4>
          <BarList items={plans.joined} label="Plans agents joined" emptyText="No sign-ups in this period." />
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold">
            What leads asked about <Count n={asked} />
          </h4>
          <BarList items={plans.asked} label="Plans leads asked about" emptyText="No leads in this period." />
        </div>
      </div>
    </Section>
  );
}

/** Where this period's leads stand now, from the lead sheet's Status column. */
export function LeadStatusCard({ status }: { status: AnalyticsView["leadStatus"] }) {
  const total = status.rows.reduce((s, r) => s + r.value, 0);
  const n = (k: string) => status.rows.find((r) => r.key === k)?.value ?? 0;
  const parts = [
    n("signed") && `${formatFull(n("signed"))} signed up`,
    n("interested") && `${formatFull(n("interested"))} ${n("interested") === 1 ? "is" : "are"} interested`,
    n("following") && `${formatFull(n("following"))} ${n("following") === 1 ? "is" : "are"} being followed up`,
    n("not") && `${formatFull(n("not"))} said no`,
  ].filter(Boolean) as string[];
  const sentence = listOf(parts);
  return (
    <Section
      title="Where these leads stand"
      description={
        total && sentence
          ? `Of ${formatFull(total)} leads from this period, ${sentence}.`
          : "The status Spiral NY's team gave each lead."
      }
      sample={status.origin === "sample"}
      footer="From the Status column on the lead sheet's FWD/FRESH and Instantly tabs, as it reads today. Leads with no date on the sheet aren't counted."
    >
      <BarList items={status.rows} label="Lead status" emptyText="No leads on the sheet in this period." />
    </Section>
  );
}
