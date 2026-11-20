-- Analytics: raw daily copies of each source, kept in Spiral OS so history
-- survives past the source's own retention (Search Console keeps 16 months)
-- and so sign-ups can be joined to pages and campaigns.
-- Safe to run more than once.

-- WPForms "Spiral OS" notification emails, parsed (one row per email).
create table if not exists spiral.form_entries (
  id               uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  form_id          integer,
  form_name        text,
  entry_id         text,
  entry_type       text not null check (entry_type in ('complete', 'abandoned')),
  received_at      timestamptz not null,
  full_name        text,
  email            text,
  phone            text,
  license_number   text,
  plan             text,
  amount_cents     integer,
  page_url         text,
  fields           jsonb not null default '{}'::jsonb,
  person_id        uuid references spiral.people (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists form_entries_received_idx on spiral.form_entries (received_at);
create index if not exists form_entries_person_idx on spiral.form_entries (person_id);

-- Google Analytics 4: sessions per day x landing page x channel x source/medium x device.
create table if not exists spiral.ga4_daily (
  day              date not null,
  landing_page     text not null,
  channel_group    text not null,
  source           text not null,
  medium           text not null,
  device           text not null,
  sessions         integer not null default 0,
  engaged_sessions integer not null default 0,
  users            integer not null default 0,
  primary key (day, landing_page, channel_group, source, medium, device)
);

-- Search Console: per search x page per day. Google leaves out rare/anonymised
-- searches here, so page totals are stored separately in gsc_daily_page.
create table if not exists spiral.gsc_daily (
  day         date not null,
  query       text not null,
  page        text not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    real not null default 0,
  primary key (day, query, page)
);
create index if not exists gsc_daily_page_idx on spiral.gsc_daily (page, day);

create table if not exists spiral.gsc_daily_page (
  day         date not null,
  page        text not null,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    real not null default 0,
  primary key (day, page)
);

-- Instantly cold email.
create table if not exists spiral.instantly_campaigns (
  id         text primary key,
  name       text not null,
  status     text,
  created_at timestamptz,
  synced_at  timestamptz not null default now()
);

create table if not exists spiral.instantly_campaign_daily (
  campaign_id text not null references spiral.instantly_campaigns (id) on delete cascade,
  day         date not null,
  sent        integer not null default 0,
  contacted   integer not null default 0,
  opened      integer not null default 0,
  replies     integer not null default 0,
  interested  integer not null default 0,
  bounced     integer not null default 0,
  primary key (campaign_id, day)
);

-- Prospects in Instantly, used only to recognise a form entry as a cold-email lead.
create table if not exists spiral.instantly_leads (
  email           text not null,
  campaign_id     text not null default '',
  status          text,
  interest_status text,
  last_reply_at   timestamptz,
  synced_at       timestamptz not null default now(),
  primary key (email, campaign_id)
);
create index if not exists instantly_leads_email_idx on spiral.instantly_leads (lower(email));

alter table spiral.form_entries             enable row level security;
alter table spiral.ga4_daily                enable row level security;
alter table spiral.gsc_daily                enable row level security;
alter table spiral.gsc_daily_page           enable row level security;
alter table spiral.instantly_campaigns      enable row level security;
alter table spiral.instantly_campaign_daily enable row level security;
alter table spiral.instantly_leads          enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
