-- Spiral NY's lead sheet, as of the last sync (replaced every sync).
-- Leads and sign-ups in Analytics count these rows together with form entries,
-- one person once (matched through spiral.people by email, else phone).
-- Safe to run more than once.
create table if not exists spiral.lead_sheet_rows (
  tab            text not null,
  row_number     integer not null,
  kind           text not null check (kind in ('lead', 'signup')),
  day            date,                 -- inquiry date, or date joined for sign-ups
  full_name      text,
  email          text,
  phone          text,
  license_number text,
  status         text,                 -- as written in the sheet
  plan           text check (plan in ('100%', '90%', 'Referral', 'Park Your License')),
  how_found      text,                 -- "How did you find us?" as written
  source         text not null default 'unknown' check (source in ('google', 'cold_email', 'referral', 'unknown')),
  person_id      uuid references spiral.people (id) on delete set null,
  primary key (tab, row_number)
);
create index if not exists lead_sheet_rows_day_idx on spiral.lead_sheet_rows (day);
create index if not exists lead_sheet_rows_email_idx on spiral.lead_sheet_rows (lower(email));

alter table spiral.lead_sheet_rows enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
