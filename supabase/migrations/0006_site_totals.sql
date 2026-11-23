-- Site-wide daily totals exactly as Search Console and Google Analytics report them.
-- Adding up per-page rows overstates them: one Google search can show several
-- spiralny.com pages (each counted), and GA4 estimates sessions per breakdown.
-- Headline numbers and trend charts read these; per-page tables keep the detail.
-- Safe to run more than once.
create table if not exists spiral.gsc_daily_site (
  day         date primary key,
  clicks      integer not null default 0,
  impressions integer not null default 0,
  position    real not null default 0
);

create table if not exists spiral.ga4_daily_site (
  day              date primary key,
  sessions         integer not null default 0,
  engaged_sessions integer not null default 0,
  users            integer not null default 0
);

alter table spiral.gsc_daily_site enable row level security;
alter table spiral.ga4_daily_site enable row level security;

revoke all on all tables in schema spiral from anon, authenticated;
revoke all on all sequences in schema spiral from anon, authenticated;
