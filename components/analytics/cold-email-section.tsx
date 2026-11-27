import { ChevronRight } from "lucide-react";
import type { AnalyticsView, EmailStepRow } from "@/lib/analytics/types";
import { formatFull, formatPercent, listOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SampleBadge } from "./chart-parts";
import { TipLabel } from "./info-tip";
import { Section } from "./section";
import { CampaignsTable } from "./simple-tables";
import { STAT_GRID, Stat } from "./stat";
import { InlineBar, RowFigure } from "./table-tools";

type Cold = AnalyticsView["coldEmail"];

/** One stage: a row on phones (label and note left, figure right), a small card from md up. */
function FunnelCard({ label, value, sub, info, tone = "instantly" }: { label: string; value: number; sub?: string; info?: string; tone?: "instantly" | "records" }) {
  return (
    <div
      className={cn(
        "grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-3.5 py-2.5 md:block md:p-3.5",
        tone === "records" ? "bg-muted/60" : "bg-card",
      )}
    >
      <p className={cn("col-start-1 row-start-1 text-xs font-medium text-muted-foreground", !sub && "row-span-2")}>
        <TipLabel label={label} info={info} />
      </p>
      <p className="col-start-2 row-span-2 row-start-1 text-xl leading-tight font-semibold tracking-tight md:mt-1 md:text-2xl">
        {formatFull(value)}
      </p>
      {sub && <p className="col-start-1 row-start-2 mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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

/**
 * Bounces and automatic replies: the health of the sending, not of interest. (No "Unsubscribed":
 * Spiral NY's emails carry no unsubscribe link, so Instantly always reports 0; people who say
 * "stop" are marked not interested instead.)
 */
export function ColdHealth({ cold }: { cold: Cold }) {
  const h = cold.health;
  if (!h) return null;
  const bounce = h.sent ? h.bounced / h.sent : 0;
  return (
    <section aria-label="Sending health" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold">Sending</h3>
        {cold.origin === "sample" && <SampleBadge />}
      </div>
      <div className={STAT_GRID}>
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
          label="Auto-replies"
          value={formatFull(h.autoReplies)}
          sub="Out-of-office and other automatic replies"
          info="People who sent an automatic reply (out of office, changed jobs, mailbox full), each counted once. Automatic replies are never counted as Replied."
        />
      </div>
    </section>
  );
}

type StepTotals = { step: number; variants: EmailStepRow[]; sent: number; replies: number; opportunities: number };

/** Each email, then its A/B versions (when it has more than one) right under it. */
function rowsOf(steps: StepTotals[]) {
  return steps.flatMap((s) => {
    const rows = [{ key: `${s.step}`, label: `Email ${s.step + 1}`, sub: false, sent: s.sent, replies: s.replies, opportunities: s.opportunities }];
    if (s.variants.length > 1) {
      for (const v of s.variants) {
        rows.push({
          key: `${s.step}-${v.variant}`,
          label: `Version ${String.fromCharCode(65 + v.variant)}`,
          sub: true,
          sent: v.sent,
          replies: v.replies,
          opportunities: v.opportunities,
        });
      }
    }
    return rows;
  });
}

/** A "best reply rate" needs volume behind it: 1 reply from 7 emails is luck, not a finding. */
const MIN_SENT = 100;

/**
 * The rows whose reply rate reads the same as the best one, as shown (0.5% and 0.5% are a tie to the
 * reader), among rows with at least MIN_SENT emails sent. `filtered` = a smaller row had a higher rate.
 */
function bestByRate<T extends { sent: number; replies: number }>(rows: T[]) {
  const replying = rows.filter((r) => r.sent > 0 && r.replies > 0);
  const big = replying.filter((r) => r.sent >= MIN_SENT);
  const pool = big.length ? big : replying;
  const top = Math.max(0, ...pool.map((r) => r.replies / r.sent));
  const text = formatPercent(top, 1);
  return {
    leaders: pool.filter((r) => formatPercent(r.replies / r.sent, 1) === text),
    text,
    filtered: big.length > 0 && replying.some((r) => r.sent < MIN_SENT && r.replies / r.sent > top),
  };
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
  const best = bestByRate(steps);
  const leaders = best.leaders.map((s) => String(s.step + 1));
  const among = best.filtered ? ` (emails sent ${MIN_SENT} times or more)` : "";
  return (
    <Section
      title="Which email gets replies"
      description={
        leaders.length === 1
          ? `Email ${leaders[0]} gets the most replies for each email sent (${best.text}), across all campaigns${among}.`
          : leaders.length > 1
            ? `Emails ${listOf(leaders)} get the most replies for each email sent (${best.text} each), across all campaigns${among}.`
            : "Replies for each email in the sequences, all campaigns together."
      }
      sample={cold.origin === "sample"}
      footer="Reply rate here is replies per email sent at that step. Where a campaign tests versions of an email (A/B), they are counted together."
    >
      {steps.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">No emails sent in this period.</p>
      ) : (
        <>
        <ul aria-label="Replies for each email" className="divide-y sm:hidden">
          {rowsOf(steps).map((r) => (
            <li key={r.key} className={cn("py-3 first:pt-1 last:pb-0", r.sub && "pl-4")}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={cn("text-sm", r.sub ? "text-muted-foreground" : "font-medium")}>{r.label}</p>
                <RowFigure value={formatFull(r.replies)} unit={r.replies === 1 ? "reply" : "replies"} />
              </div>
              <div className="mt-2">
                <InlineBar ratio={maxRate ? rate(r) / maxRate : 0} label={formatPercent(rate(r), 1)} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground tabular">
                {formatFull(r.sent)} sent, {formatFull(r.opportunities)} interested
              </p>
            </li>
          ))}
        </ul>
        <div className="relative hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th scope="col" className="py-2 pr-3 text-left font-medium">
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
                <th scope="col" className="py-2 text-right font-medium">
                  Interested
                </th>
              </tr>
            </thead>
            <tbody>
              {rowsOf(steps).map((r) => (
                <tr key={r.key} className={cn("border-b transition-colors last:border-0 hover:bg-muted/50", r.sub && "text-muted-foreground")}>
                  <th scope="row" className={cn("py-2.5 pr-3 text-left font-medium", r.sub && "pl-4 font-normal")}>
                    {r.label}
                  </th>
                  <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.sent)}</td>
                  <td className="py-2.5 pr-3 text-right tabular">{formatFull(r.replies)}</td>
                  <td className="py-2.5 pr-3">
                    <InlineBar ratio={maxRate ? rate(r) / maxRate : 0} label={formatPercent(rate(r), 1)} />
                  </td>
                  <td className="py-2.5 text-right tabular">{formatFull(r.opportunities)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </Section>
  );
}

export function CampaignsSection({ cold }: { cold: Cold }) {
  const best = bestByRate(cold.rows);
  const leaders = best.leaders.map((r) => r.name);
  const among = best.filtered ? ` among campaigns that sent ${MIN_SENT} or more emails` : "";
  return (
    <Section
      title="Campaigns"
      description={
        leaders.length === 1
          ? `${leaders[0]} has the best reply rate (${best.text} of emails sent)${among}. Sort any column to compare.`
          : leaders.length > 1
            ? `${listOf(leaders)} share the best reply rate (${best.text} of emails sent)${among}. Sort any column to compare.`
            : "Each Instantly campaign in this period. Sort any column to compare."
      }
      sample={cold.origin === "sample"}
      footer="Became leads and Signed up count people whose source is cold email, under each campaign whose lead list has their email address. A few cold-email leads come from the lead sheet's Instantly tab without a campaign, so these columns can add up to less than the funnel above."
    >
      <CampaignsTable rows={cold.rows} />
    </Section>
  );
}
