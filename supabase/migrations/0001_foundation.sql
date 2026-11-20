-- Spiral OS foundation: one record per person, user roles, stored integrations, sync log.
--
-- Everything lives in the `spiral` schema. Supabase's public Data API only
-- exposes `public`, and on top of that every table has row-level security on
-- with no policies and no grants to anon/authenticated, so nothing here is
-- readable from the browser. The app reads and writes on the server only.
-- Safe to run more than once.

create schema if not exists spiral;
revoke all on schema spiral from public;
revoke all on schema spiral from anon, authenticated;

-- Who can sign in to Spiral OS, and what they can see.
--   owner   = Marcel (all tabs, including Analytics and Billing)
--   team    = Spiral NY staff (operational tabs)
--   opslabs = OpsLabs builders (everything + integration settings)
create table if not exists spiral.profiles (
  user_id    uuid primary key,              -- Supabase Auth user id
  email      text not null unique,
  full_name  text,
  role       text not null check (role in ('owner', 'team', 'opslabs')),
  created_at timestamptz not null default now()
);

-- The foundation: one record per person, from first form to Spiral Cloud.
create table if not exists spiral.people (
  id             uuid primary key default gen_random_uuid(),
  full_name      text,
  email          text,
  phone          text,                      -- digits only, US numbers without +1
  license_number text,
  state          text check (state in ('NY', 'GA')),
  kind           text not null default 'lead'
                   check (kind in ('lead', 'agent')),
  stage          text not null default 'new'
                   check (stage in ('new', 'contacted', 'thinking', 'getting_license', 'signed', 'not_interested')),
  source         text not null default 'unknown'
                   check (source in ('google', 'cold_email', 'referral', 'website', 'lead_sheet', 'unknown')),
  source_detail  text,
  first_seen_at  timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists people_email_key on spiral.people (lower(email)) where email is not null;
create index if not exists people_phone_idx on spiral.people (phone) where phone is not null;
create index if not exists people_first_seen_idx on spiral.people (first_seen_at);

-- Stored credentials (encrypted with APP_ENCRYPTION_KEY before they reach the database).
create table if not exists spiral.integrations (
  provider          text primary key check (provider in ('google')),
  account_email     text,
  secret_ciphertext text not null,
  scopes            text[] not null default '{}',
  connected_at      timestamptz not null default now()
);

-- One row per sync attempt. Drives "last updated" labels and the sample-data switch.
create table if not exists spiral.sync_runs (
  id           bigserial primary key,
  source       text not null check (source in ('ga4', 'gsc', 'instantly', 'forms', 'lead_sheet')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running', 'success', 'error', 'skipped')),
  rows_written integer not null default 0,
  range_start  date,
  range_end    date,
  message      text
);
create index if not exists sync_runs_source_idx on spiral.sync_runs (source, started_at desc);

alter table spiral.profiles     enable row level security;
alter table spiral.people       enable row level security;
alter table spiral.integrations enable row level security;
alter table spiral.sync_runs    enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
