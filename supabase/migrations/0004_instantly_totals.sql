-- Instantly's own campaign totals for each date range the Analytics tab offers
-- (and the period before each). Adding up daily numbers drifts from Instantly's
-- screens: a person who replies on two days counts twice, and opportunities
-- that are later removed stay in the daily counts. So totals come from
-- Instantly directly; daily rows still draw the trend lines.
-- Replaced on every sync. Safe to run more than once.
create table if not exists spiral.instantly_range_totals (
  range_start date not null,
  range_end   date not null,
  campaign_id text not null,
  sent        integer not null default 0,
  replies     integer not null default 0, -- unique replies, auto-replies excluded (Instantly's reply_count_unique)
  interested  integer not null default 0, -- Instantly's total_opportunities
  synced_at   timestamptz not null default now(),
  primary key (range_start, range_end, campaign_id)
);

alter table spiral.instantly_range_totals enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
