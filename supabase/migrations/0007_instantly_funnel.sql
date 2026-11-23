-- Cold email depth: Instantly's own funnel and per-email numbers for each date
-- range the Analytics tab offers (replaced every sync). Safe to run more than once.

-- Per campaign: who was emailed, bounced, unsubscribed (from the same call as sent/replies).
alter table spiral.instantly_range_totals add column if not exists contacted integer not null default 0;
alter table spiral.instantly_range_totals add column if not exists bounced integer not null default 0;
alter table spiral.instantly_range_totals add column if not exists unsubscribed integer not null default 0;

-- All campaigns together (Instantly's analytics overview).
create table if not exists spiral.instantly_range_overview (
  range_start        date not null,
  range_end          date not null,
  sent               integer not null default 0,
  contacted          integer not null default 0,
  replied            integer not null default 0, -- unique replies, auto-replies excluded
  interested         integer not null default 0,
  meetings_booked    integer not null default 0,
  meetings_completed integer not null default 0,
  won                integer not null default 0,
  bounced            integer not null default 0,
  unsubscribed       integer not null default 0,
  synced_at          timestamptz not null default now(),
  primary key (range_start, range_end)
);

-- Each email in the sequences (step 0 = the first email; variant 0 = A), all campaigns added up.
create table if not exists spiral.instantly_range_steps (
  range_start   date not null,
  range_end     date not null,
  step          integer not null,
  variant       integer not null,
  sent          integer not null default 0,
  replies       integer not null default 0, -- unique replies
  opportunities integer not null default 0,
  primary key (range_start, range_end, step, variant)
);

alter table spiral.instantly_range_overview enable row level security;
alter table spiral.instantly_range_steps enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
