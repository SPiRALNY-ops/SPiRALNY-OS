/**
 * Instantly -> campaigns, daily campaign numbers, and the cold-email match for
 * form entries: each form-entry email is looked up once in Instantly; a person
 * who was added to a campaign and emailed before their first form entry gets
 * source "cold_email".
 */
import { addDays, RANGE_KEYS, resolveRange } from "@/lib/analytics/range";
import {
  CAMPAIGN_STATUS,
  INTEREST_STATUS,
  LEAD_STATUS,
  campaignDaily,
  campaignOverview,
  campaignSteps,
  campaignTotals,
  findLeadsByEmail,
  listCampaigns,
} from "@/lib/sources/instantly";
import { hasRows, insertRows, lastSyncedThrough } from "./store";
import type { SourceResult, SyncContext } from "./types";

const BACKFILL_DAYS = 760;
const LOOKBACK_DAYS = 7; // replies and opportunities keep landing on recent days

export async function syncInstantly(ctx: SyncContext): Promise<SourceResult> {
  const { db, today } = ctx;
  const apiKey = ctx.config.instantlyApiKey!;

  // 1. Campaigns.
  const campaigns = await listCampaigns(ctx.fetch, apiKey);
  await insertRows(
    db,
    "spiral.instantly_campaigns",
    [["id", "text"], ["name", "text"], ["status", "text"], ["created_at", "timestamptz"]],
    campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: CAMPAIGN_STATUS[String(c.status)] ?? String(c.status),
      created_at: c.timestamp_created ?? null,
    })),
    `on conflict (id) do update set name = excluded.name, status = excluded.status,
       created_at = excluded.created_at, synced_at = now()`,
  );

  // 2. Daily numbers (UTC days, as Instantly reports them).
  const through = await lastSyncedThrough(db, "instantly");
  const earliest = campaigns
    .map((c) => c.timestamp_created?.slice(0, 10))
    .filter((d): d is string => Boolean(d))
    .sort()[0];
  const floor = addDays(today, -BACKFILL_DAYS);
  const start = through ? addDays(through, -LOOKBACK_DAYS) : earliest && earliest > floor ? earliest : floor;
  const end = today;

  let written = 0;
  for (const c of campaigns.filter((c) => c.status !== 0)) {
    const days = await campaignDaily(ctx.fetch, apiKey, c.id, start, end);
    await db.transaction(async (tx) => {
      await tx.query(
        "delete from spiral.instantly_campaign_daily where campaign_id = $1 and day between $2::date and $3::date",
        [c.id, start, end],
      );
      written += await insertRows(
        tx,
        "spiral.instantly_campaign_daily",
        [
          ["campaign_id", "text"],
          ["day", "date"],
          ["sent", "integer"],
          ["contacted", "integer"],
          ["opened", "integer"],
          ["replies", "integer"],
          ["interested", "integer"],
        ],
        days
          .filter((d) => d.date >= start && d.date <= end)
          .map((d) => ({
            campaign_id: c.id,
            day: d.date.slice(0, 10),
            sent: d.sent ?? 0,
            contacted: d.contacted ?? 0,
            opened: d.unique_opened ?? 0,
            replies: d.unique_replies ?? 0, // unique leads who replied that day
            interested: d.unique_opportunities ?? 0,
          })),
        "on conflict do nothing",
      );
    });
  }

  // 3. Instantly's own totals for every range the Analytics tab offers, and the period before each.
  const periods = new Map<string, [string, string]>();
  const currentPeriods = new Map<string, [string, string]>();
  for (const key of RANGE_KEYS) {
    const r = resolveRange(key, today);
    periods.set(`${r.start}/${r.end}`, [r.start, r.end]);
    currentPeriods.set(`${r.start}/${r.end}`, [r.start, r.end]);
    periods.set(`${r.previousStart}/${r.previousEnd}`, [r.previousStart, r.previousEnd]);
  }
  const known = new Set(campaigns.map((c) => c.id));
  const totals: Record<string, unknown>[] = [];
  for (const [rangeStart, rangeEnd] of periods.values()) {
    for (const t of await campaignTotals(ctx.fetch, apiKey, rangeStart, rangeEnd)) {
      if (!known.has(t.campaign_id)) continue;
      totals.push({
        range_start: rangeStart,
        range_end: rangeEnd,
        campaign_id: t.campaign_id,
        sent: t.emails_sent_count ?? 0,
        replies: t.reply_count_unique ?? 0,
        interested: t.total_opportunities ?? 0,
        contacted: t.contacted_count ?? 0,
        bounced: t.bounced_count ?? 0,
        unsubscribed: t.unsubscribed_count ?? 0,
      });
    }
  }
  await db.transaction(async (tx) => {
    await tx.query("delete from spiral.instantly_range_totals");
    await insertRows(
      tx,
      "spiral.instantly_range_totals",
      [
        ["range_start", "date"],
        ["range_end", "date"],
        ["campaign_id", "text"],
        ["sent", "integer"],
        ["replies", "integer"],
        ["interested", "integer"],
        ["contacted", "integer"],
        ["bounced", "integer"],
        ["unsubscribed", "integer"],
      ],
      totals,
      "on conflict do nothing",
    );
  });

  // 3b. The funnel (all campaigns) for every period, and each email of the sequences for the current periods.
  // Steps are added up by position across campaigns (Email 1, Email 2…). A/B versions are folded into
  // their email: "version B" of one campaign has nothing to do with "version B" of another.
  const overviews: Record<string, unknown>[] = [];
  for (const [rangeStart, rangeEnd] of periods.values()) {
    const o = await campaignOverview(ctx.fetch, apiKey, rangeStart, rangeEnd);
    overviews.push({
      range_start: rangeStart,
      range_end: rangeEnd,
      sent: o.emails_sent_count ?? 0,
      contacted: o.contacted_count ?? 0,
      new_contacted: o.new_leads_contacted_count ?? 0,
      replied: o.reply_count_unique ?? 0,
      interested: o.total_interested ?? 0,
      meetings_booked: o.total_meeting_booked ?? 0,
      meetings_completed: o.total_meeting_completed ?? 0,
      won: o.total_closed ?? 0,
      bounced: o.bounced_count ?? 0,
      unsubscribed: o.unsubscribed_count ?? 0,
    });
  }
  const steps = new Map<string, { range_start: string; range_end: string; step: number; variant: number; sent: number; replies: number; opportunities: number }>();
  for (const [rangeStart, rangeEnd] of currentPeriods.values()) {
    for (const c of campaigns.filter((c) => c.status !== 0)) {
      for (const s of await campaignSteps(ctx.fetch, apiKey, c.id, rangeStart, rangeEnd)) {
        const step = Number.parseInt(String(s.step), 10);
        if (!Number.isFinite(step)) continue; // events Instantly couldn't place in a step
        const k = `${rangeStart}/${rangeEnd}/${step}`;
        const row = steps.get(k) ?? { range_start: rangeStart, range_end: rangeEnd, step, variant: 0, sent: 0, replies: 0, opportunities: 0 };
        row.sent += s.sent ?? 0;
        row.replies += s.unique_replies ?? 0;
        row.opportunities += s.unique_opportunities ?? 0;
        steps.set(k, row);
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.query("delete from spiral.instantly_range_overview");
    await tx.query("delete from spiral.instantly_range_steps");
    await insertRows(
      tx,
      "spiral.instantly_range_overview",
      [
        ["range_start", "date"],
        ["range_end", "date"],
        ["sent", "integer"],
        ["contacted", "integer"],
        ["new_contacted", "integer"],
        ["replied", "integer"],
        ["interested", "integer"],
        ["meetings_booked", "integer"],
        ["meetings_completed", "integer"],
        ["won", "integer"],
        ["bounced", "integer"],
        ["unsubscribed", "integer"],
      ],
      overviews,
      "on conflict do nothing",
    );
    await insertRows(
      tx,
      "spiral.instantly_range_steps",
      [["range_start", "date"], ["range_end", "date"], ["step", "integer"], ["variant", "integer"], ["sent", "integer"], ["replies", "integer"], ["opportunities", "integer"]],
      [...steps.values()],
      "on conflict do nothing",
    );
  });

  // 4. Match form-entry emails to Instantly leads (each address once).
  const pending = (
    await db.query<{ email: string }>(
      `select distinct e.email from (
          select lower(email) as email from spiral.form_entries where email is not null
          union select lower(email) from spiral.lead_sheet_rows where email is not null
        ) e
        where not exists (select 1 from spiral.instantly_lookups l where l.email = e.email)`,
    )
  ).map((r) => r.email);
  let matched = 0;
  if (pending.length) {
    const leads = (await findLeadsByEmail(ctx.fetch, apiKey, pending)).filter((l) => l.email && l.campaign);
    matched = leads.length;
    await db.transaction(async (tx) => {
      await insertRows(
        tx,
        "spiral.instantly_leads",
        [
          ["email", "text"],
          ["campaign_id", "text"],
          ["lead_id", "text"],
          ["status", "text"],
          ["interest_status", "text"],
          ["created_at", "timestamptz"],
          ["last_contact_at", "timestamptz"],
          ["last_reply_at", "timestamptz"],
        ],
        leads.map((l) => ({
          email: l.email!.toLowerCase(),
          campaign_id: l.campaign!,
          lead_id: l.id,
          status: l.status !== undefined ? (LEAD_STATUS[String(l.status)] ?? String(l.status)) : null,
          interest_status:
            l.lt_interest_status !== undefined && l.lt_interest_status !== null
              ? (INTEREST_STATUS[String(l.lt_interest_status)] ?? String(l.lt_interest_status))
              : null,
          created_at: l.timestamp_created ?? null,
          last_contact_at: l.timestamp_last_contact ?? null,
          last_reply_at: l.timestamp_last_reply ?? null,
        })),
        `on conflict (email, campaign_id) do update set
           lead_id = excluded.lead_id, status = excluded.status, interest_status = excluded.interest_status,
           created_at = excluded.created_at, last_contact_at = excluded.last_contact_at,
           last_reply_at = excluded.last_reply_at, synced_at = now()`,
      );
      const counts = new Map<string, number>();
      for (const l of leads) counts.set(l.email!.toLowerCase(), (counts.get(l.email!.toLowerCase()) ?? 0) + 1);
      await insertRows(
        tx,
        "spiral.instantly_lookups",
        [["email", "text"], ["matches", "integer"]],
        pending.map((email) => ({ email, matches: counts.get(email) ?? 0 })),
        "on conflict (email) do update set matches = excluded.matches, checked_at = now()",
      );
    });
  }

  // 5. Cold email = in a campaign and emailed, added before the person's first form entry.
  await db.query(
    `update spiral.people p
        set source = 'cold_email', source_detail = m.campaign_name, updated_at = now()
       from (
         select distinct on (lower(il.email)) lower(il.email) as email, c.name as campaign_name, il.created_at
           from spiral.instantly_leads il
           left join spiral.instantly_campaigns c on c.id = il.campaign_id
          where il.last_contact_at is not null
          order by lower(il.email), il.created_at
       ) m
      where lower(p.email) = m.email
        and p.source in ('unknown', 'website')
        and (m.created_at is null or m.created_at <= p.first_seen_at)`,
  );

  if (!(await hasRows(db, "spiral.instantly_campaigns"))) {
    return { status: "skipped", rows: 0, message: "The Instantly workspace has no campaigns yet." };
  }
  return {
    status: "success",
    rows: written,
    rangeStart: start,
    rangeEnd: end,
    message: `${campaigns.length} campaigns; ${pending.length} form email(s) checked, ${matched} Instantly match(es).`,
  };
}
