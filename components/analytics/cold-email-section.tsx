import { ChevronRight } from "lucide-react";
import type { AnalyticsView, EmailStepRow } from "@/lib/analytics/types";
import { formatFull, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";
import { InfoTip } from "./info-tip";
import { Section } from "./section";
import { CampaignsTable } from "./simple-tables";
import { Stat } from "./stat";

type Cold = AnalyticsView["coldEmail"];

function FunnelCard({ label, value, sub, info, tone = "instantly" }: { label: string; value: number; sub?: string; info?: string; tone?: "instantly" | "records" }) {
  return (
    <div className={cn("min-w-0 flex-1 rounded-lg border p-3.5", tone === "records" ? "bg-muted/60" : "bg-card")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {info && <InfoTip label={label}>{info}</InfoTip>}
      </p>
      <p className="mt-1 text-2xl leading-tight font-semibold tracking-tight">{formatFull(value)}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const Arrow = () => <ChevronRight aria-hidden className="hidden size-4 shrink-0 self-center text-muted-foreground md:block" />;

/** From the first email to a signed agent: Instantly's stages, then Spiral NY's own records. */
export function ColdFunnel({ cold, leads, signups, periodLabel }: { cold: Cold; leads: number; signups: number; periodLabel: string }) {
  const steps = cold.funnel;
  const sent = steps.find((s) => s.key === "sent")?.value ?? 0;
  const replied = steps.find((s) => s.key === "replied")?.value ?? 0;
  const ofPrev = (i: number) => {
    const prev = steps[i - 1]?.value;
    if (!prev) return undefined;
    return `${formatPercent(steps[i].value / prev, steps[i].value / prev < 0.1 ? 1 : 0)} of ${steps[i - 1].label.toLowerCase()}`;
  };
  return (
    <Section
      title="From first email to signed agent"
      description={
        sent
          ? `In the last ${periodLabel}, ${formatFull(sent)} emails went out and ${formatFull(replied)} people replied: about 1 reply for every ${formatFull(Math.round(sent / Math.max(replied, 1)))} emails.`
          : "Instantly's stages, then Spiral NY's own records."
      }
      sample={cold.origin === "sample"}
      footer="The first stages are Instantly's own totals for this period. Leads and sign-ups come from the lead sheet and forms: people whose source is cold email."
    >
      {steps.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Instantly&apos;s totals for this period arrive with the next sync.</p>
      ) : (
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
          {steps.map((s, i) => (
            <div key={s.key} className="flex min-w-0 flex-1 gap-2">
              {i > 0 && <Arrow />}
              <FunnelCard label={s.label} value={s.value} sub={i === 0 ? "follow-ups included" : ofPrev(i)} info={s.note} />
            </div>
          ))}
          <div className="my-1 border-t md:mx-1 md:my-0 md:border-t-0 md:border-l" aria-hidden />
          <FunnelCard
            label="Became leads"
            value={leads}
            tone="records"
            info="New leads this period whose source is cold email (the lead sheet's Instantly tab, or matched to an Instantly campaign)."
          />
          <div className="flex min-w-0 flex-1 gap-2">
            <Arrow />
            <FunnelCard label="Signed up" value={signups} tone="records" info="Sign-ups this period whose source is cold email." />
          </div>
        </div>
      )}
    </Section>
  );
}

/** Bounces and unsubscribes: the health of the sending, not of interest. */
export function ColdHealth({ cold }: { cold: Cold }) {
  const h = cold.health;
  if (!h) return null;
  const bounce = h.sent ? h.bounced / h.sent : 0;
  const unsub = h.sent ? h.unsubscribed / h.sent : 0;
  return (
    <section aria-label="Sending health" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">Sending</h3>
        {cold.origin === "sample" && <SampleBadge />}
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
        <Stat label="Emails sent" value={formatFull(h.sent)} info="Every email Instantly sent in this period, follow-ups included." />
        <Stat
          label="New people emailed"
          value={formatFull(h.newContacted)}
          info="People who got their first email from a campaign in this period. Everyone else emailed was already part of a sequence."
        />
        <Stat
          label="Bounced"
          value={formatPercent(bounce, 1)}
          sub={`${formatFull(h.bounced)} bounced, out of ${formatFull(h.sent)} emails sent`}
          info="Emails that couldn't be delivered (bad or closed addresses). Many bounces make inbox providers trust the sending address less."
        />
        <Stat
          label="Unsubscribed"
          value={formatPercent(unsub, 1)}
          sub={`${formatFull(h.unsubscribed)} ${h.unsubscribed === 1 ? "person" : "people"}, out of ${formatFull(h.sent)} emails sent`}
          info="People who asked not to be emailed again."
        />
      </div>
    </section>
  );
}

/** Which email in the sequences gets replies (all campaigns together), A/B variants listed under their email. */
export function EmailSteps({ cold }: { cold: Cold }) {
  const byStep = new Map<number, EmailStepRow[]>();
  for (const r of cold.steps) byStep.set(r.step, [...(byStep.get(r.step) ?? []), r]);
  const steps = [...byStep.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([step, variants]) => ({
      step,
      variants,
      sent: variants.reduce((s, v) => s + v.sent, 0),
      replies: variants.reduce((s, v) => s + v.replies, 0),
      opportunities: variants.reduce((s, v) => s + v.opportunities, 0),
    }));
  const rate = (r: { sent: number; replies: number }) => (r.sent ? r.replies / r.sent : 0);
  const maxRate = Math.max(...steps.map(rate), 0);
  const best = [...steps].sort((a, b) => rate(b) - rate(a))[0];
  return (
    <Section
      title="Which email gets replies"
      description={
        best && best.replies
          ? `Email ${best.step + 1} gets the most replies for each email sent (${formatPercent(rate(best), 1)}), across all campaigns.`
          : "Replies for each email in the sequences, all campaigns together."
      }
      sample={cold.origin === "sample"}
      footer="Reply rate here is replies per email sent at that step. Where a campaign tests versions of an email (A/B), they are counted together."
    >
      {steps.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No emails sent in this period.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 pl-4 text-left font-medium sm:pl-0">
                  Email
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Sent
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Replies
                </th>
                <th scope="col" className="w-[34%] py-2 pr-3 text-left font-medium">
                  Reply rate
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium sm:pr-0">
                  Interested
                </th>
              </tr>
            </thead>
            <tbody>
              {steps.flatMap((s) => {
                const rows = [{ key: `${s.step}`, label: `Email ${s.step + 1}`, sub: false, ...s }];
                if (s.variants.length > 1) {
                  for (const v of s.variants) {
                    rows.push({ key: `${s.step}-${v.variant}`, label: `Version ${String.fromCharCode(65 + v.variant)}`, sub: true, ...s, ...v });
                  }
                }
                return rows.map((r) => (
                  <tr key={r.key} className={cn("border-b transition-colors last:border-0 hover:bg-muted/50", r.sub && "text-muted-foreground")}>
                    <th scope="row" className={cn("py-2.5 pr-3 pl-4 text-left font-medium sm:pl-0", r.sub && "pl-8 font-normal sm:pl-4")}>
                      {r.label}
                    </th>
                    <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.sent)}</td>
                    <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.replies)}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div aria-hidden className="h-2 flex-1 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-chart-slate"
                            style={{ width: maxRate ? `${Math.max((rate(r) / maxRate) * 100, r.replies ? 1.5 : 0)}%` : 0 }}
                          />
                        </div>
                        <span className="w-11 text-right text-xs tabular">{formatPercent(rate(r), 1)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular sm:pr-0">{formatFull(r.opportunities)}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

export function CampaignsSection({ cold }: { cold: Cold }) {
  const withSends = cold.rows.filter((r) => r.sent > 0);
  const best = [...withSends].sort((a, b) => b.replies / b.sent - a.replies / a.sent)[0];
  return (
    <Section
      title="Campaigns"
      description={
        best && best.sent
          ? `${best.name} has the best reply rate (${formatPercent(best.replies / best.sent, 1)} of emails sent). Sort any column to compare.`
          : "Each Instantly campaign in this period. Sort any column to compare."
      }
      sample={cold.origin === "sample"}
      footer="A lead or sign-up counts toward a campaign when their email address is in that campaign's lead list."
    >
      <CampaignsTable rows={cold.rows} />
    </Section>
  );
}
