import { CircleCheck, CircleAlert } from "lucide-react";
import type { LongView, PlanKey } from "@/lib/analytics/types";
import { formatFull, formatPercent, plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BarList } from "./bar-list";
import { Section } from "./section";
import { STAT_GRID, Stat } from "./stat";
import { InlineBar } from "./table-tools";
import { soFar } from "@/lib/analytics/range";
import { StackCard } from "./trend-cards";

type Leads = NonNullable<LongView["leads"]>;

/** Fixed colour per plan, in a validated stacking order (100% → 90% → Park → Referral). */
const PLAN_SERIES: { key: PlanKey | "none"; label: string; color: string }[] = [
  { key: "100%", label: "100% commission", color: "var(--chart-1)" },
  { key: "90%", label: "90% commission", color: "var(--chart-2)" },
  { key: "Park Your License", label: "Park Your License", color: "var(--chart-3)" },
  { key: "Referral", label: "Referral agent", color: "var(--chart-4)" },
  { key: "none", label: "Plan not written down", color: "var(--chart-5)" },
];

export function SignupsByMonth({ leads }: { leads: Leads }) {
  const series = PLAN_SERIES.filter((s) => s.key !== "none" || leads.signups.plans.none.some((n) => n > 0)).map((s) => ({
    ...s,
    values: leads.signups.plans[s.key],
  }));
  const first = leads.signupMonths[0];
  const full = leads.signupMonths.filter((m) => !m.partial);
  const avg = full.length ? full.reduce((s, m) => s + leads.signups.total[leads.signupMonths.indexOf(m)], 0) / full.length : 0;
  return (
    <StackCard
      id="by-month"
      title="Agents who joined, by month and plan"
      description={
        full.length
          ? `About ${formatFull(Math.round(avg))} agents a month over the ${plural(full.length, "complete month", "complete months")} on record. The period picker doesn't change this.`
          : "Agents who joined each month, by the plan they chose."
      }
      footer={`From the SIGNED! tab (it starts ${first ? first.label : "recently"}) and completed sign-up forms, each agent once. Months marked "so far" aren't over.`}
      months={leads.signupMonths}
      series={series}
      noun="agents"
    />
  );
}

/** How each month's new leads turned out: how many of them have signed since. */
export function LeadOutcomes({ leads }: { leads: Leads }) {
  const rows = leads.inquiryMonths.filter((m) => m.leads > 0);
  const best = [...rows].filter((m) => !m.month.partial && m.leads >= 10).sort((a, b) => b.signed / b.leads - a.signed / a.leads)[0];
  return (
    <div id="outcomes" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="How each month's leads turned out"
        sample={false}
        description={
          best
            ? `${best.month.label}'s leads signed most often: ${formatFull(best.signed)} of ${formatFull(best.leads)} (${formatPercent(best.signed / best.leads, 0)}).`
            : "Of the leads that came in each month, how many have signed since."
        }
        footer="Leads by the month they first came in (dated rows on the lead sheet and sign-up forms). Signed = on the SIGNED! tab, a completed sign-up form, or status Signed up. Recent months are still in progress."
      >
        {rows.length ? (
          <ul className="divide-y">
            {rows.map((m) => (
              <li key={m.month.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-2.5 first:pt-0">
                <span className="font-medium">
                  {m.month.label}
                  {m.month.partial ? <span className="font-normal text-muted-foreground">{soFar(m.month)}</span> : null}
                </span>
                <span className="text-right text-sm">
                  <span className="font-semibold tabular">{formatFull(m.signed)}</span>
                  <span className="text-muted-foreground"> of {formatFull(m.leads)} signed</span>
                </span>
                <div className="col-span-2">
                  <InlineBar ratio={m.leads ? m.signed / m.leads : 0} label={formatPercent(m.leads ? m.signed / m.leads : 0, 0)} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No dated leads yet.</p>
        )}
      </Section>
    </div>
  );
}

export function FollowUpBacklog({ leads }: { leads: Leads }) {
  const b = leads.backlog;
  const chasing = b.rows.find((r) => r.key === "following")?.value ?? 0;
  return (
    <div id="backlog" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Where every lead stands today"
        sample={false}
        description={`${formatFull(b.total)} leads on the sheet: ${formatFull(chasing)} still being followed up. The period picker doesn't change this.`}
        footer={`From the Status column on the FWD/FRESH and Instantly tabs, as it reads today, including the ${formatFull(b.undated)} leads with no date. Each person once.`}
      >
        <BarList items={b.rows} label="Lead status today" />
      </Section>
    </div>
  );
}

export function Onboarding({ leads }: { leads: Leads }) {
  const o = leads.onboarding;
  return (
    <div id="onboarding" className="scroll-mt-32 lg:scroll-mt-20">
      <section aria-label="New agents" className="rounded-xl border bg-card p-4 shadow-xs sm:p-5">
        <h3 className="mb-1 text-base font-bold">New agents</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {o.notAssociated || o.notWhatsapp
            ? `Of ${formatFull(o.signed)} agents on the SIGNED! tab, ${formatFull(o.notAssociated)} aren't marked associated and ${formatFull(o.notWhatsapp)} aren't in the WhatsApp group yet.`
            : `All ${formatFull(o.signed)} agents on the SIGNED! tab are associated and in the WhatsApp group.`}
        </p>
        <div className={STAT_GRID}>
          <Stat label="Agents joined" value={formatFull(o.signed)} info="Everyone on the SIGNED! tab." />
          <Stat
            label="Associated"
            value={formatFull(o.associated)}
            sub={o.notAssociated ? `${formatFull(o.notAssociated)} not ticked yet` : "All ticked"}
            info={`"Check if Associated" is ticked on the SIGNED! tab.`}
          />
          <Stat
            label="In the WhatsApp group"
            value={formatFull(o.whatsapp)}
            sub={o.notWhatsapp ? `${formatFull(o.notWhatsapp)} not added yet` : "Everyone added"}
            info={`"Added to WhatsApp Group" is ticked on the SIGNED! tab.`}
          />
          <Stat label="Withdrew" value={formatFull(o.withdrew)} info="The SIGNED! notes say the agent withdrew their association. They aren't counted as still to do." />
        </div>
      </section>
    </div>
  );
}

/** What's missing on the lead sheet, so the numbers above can be complete. */
export function SheetHealth({ leads }: { leads: Leads }) {
  const h = leads.health;
  const checks = [
    { key: "date", ok: h.noDate === 0, okText: "Every lead has a date", text: `${plural(h.noDate, "lead has", "leads have")} no date`, why: "Without a date a lead can't be counted in any period or chart." },
    { key: "source", ok: h.signupsNoSource === 0, okText: "Every agent who joined has a source", text: `${formatFull(h.signupsNoSource)} of ${plural(h.signups, "agent", "agents")} who joined have no source`, why: `Write how they found Spiral NY in the SIGNED! notes, starting with "Email", "SEO" or "Referred by".` },
    { key: "leadsource", ok: h.noSource === 0, okText: "Every lead has a source", text: `${formatFull(h.noSource)} of ${plural(h.leadRows, "lead", "leads")} have no source`, why: `Fill in "How did you find us?" on FWD/FRESH.` },
    { key: "plan", ok: h.noPlan === 0, okText: "Every lead says which plan they asked about", text: `${formatFull(h.noPlan)} leads don't say which plan they asked about`, why: `Fill in "Inquiring about?" (100%, 90%, Park Your License or Referral).` },
  ];
  return (
    <div id="sheet-health" className="scroll-mt-32 lg:scroll-mt-20">
      <Section
        title="Lead sheet check"
        sample={false}
        description="What's missing on the sheet. Each fix makes the numbers on this page more complete."
        footer={leads.historyDays > 1 ? undefined : "From today, each lead's status is also saved daily, so changes in the pipeline can be shown after two weeks."}
      >
        <ul className="divide-y">
          {checks.map((c) => {
            const Icon = c.ok ? CircleCheck : CircleAlert;
            return (
              <li key={c.key} className="flex gap-3 py-2.5 first:pt-0">
                <Icon aria-hidden className={cn("mt-0.5 size-[18px] shrink-0", c.ok ? "text-good" : "text-warn")} />
                <span className="min-w-0">
                  <span className="font-medium">{c.ok ? c.okText : c.text}</span>
                  {!c.ok && <span className="block text-sm text-muted-foreground">{c.why}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}
