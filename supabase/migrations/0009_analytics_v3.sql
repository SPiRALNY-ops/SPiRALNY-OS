-- Analytics v3, release 1: onboarding checkboxes, lead status history, sync bookkeeping,
-- auto-replies, and an index for the search detail panel. Safe to run more than once.

-- SIGNED! tab: the "Check if Associated" and "Added to WhatsApp Group" checkboxes, and whether
-- the notes say the agent withdrew their association. The note text itself is never stored.
alter table spiral.lead_sheet_rows add column if not exists associated boolean;
alter table spiral.lead_sheet_rows add column if not exists whatsapp   boolean;
alter table spiral.lead_sheet_rows add column if not exists withdrew   boolean;

-- Each lead's status as the sheet showed it, stored only when it changes. Keyed by the person
-- (email, else phone), because sheet row numbers move when the team sorts or inserts rows.
create table if not exists spiral.lead_status_changes (
  lead_key text not null,
  day      date not null,
  status   text not null,
  primary key (lead_key, day)
);
create index if not exists lead_status_changes_day_idx on spiral.lead_status_changes (day);

-- Sync bookkeeping: a lease so only one sync runs at a time (also across two servers during a
-- deploy), with a heartbeat, plus progress markers for data that is read a little at a time.
create table if not exists spiral.sync_state (
  key        text primary key,
  value      text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Out-of-office and other automatic replies (Instantly's reply_count_automatic_unique).
alter table spiral.instantly_range_overview add column if not exists auto_replies integer not null default 0;

-- The search detail panel reads one search across all days.
create index if not exists gsc_daily_query_day_idx on spiral.gsc_daily (query, day);

alter table spiral.lead_status_changes enable row level security;
alter table spiral.sync_state          enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
