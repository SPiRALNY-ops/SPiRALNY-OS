-- Connectors: what the daily sync needs beyond the raw tables in 0002.
-- Safe to run more than once.

-- Google connection health: set when a token refresh fails (e.g. access was
-- revoked), cleared on the next successful connect. Drives "Reconnect Google".
alter table spiral.integrations add column if not exists connected_by text;
alter table spiral.integrations add column if not exists last_error text;
alter table spiral.integrations add column if not exists last_error_at timestamptz;

-- Instantly leads: when the prospect was added to the campaign and last emailed,
-- so a form entry only counts as cold email if the email came first.
alter table spiral.instantly_leads add column if not exists lead_id text;
alter table spiral.instantly_leads add column if not exists created_at timestamptz;
alter table spiral.instantly_leads add column if not exists last_contact_at timestamptz;

-- Which form-entry emails have been looked up in Instantly (including "no match"),
-- so each address is checked once instead of on every sync.
create table if not exists spiral.instantly_lookups (
  email      text primary key,            -- lower-cased
  matches    integer not null default 0,
  checked_at timestamptz not null default now()
);

alter table spiral.instantly_lookups enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
