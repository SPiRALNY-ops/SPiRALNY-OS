-- New people emailed in a period (Instantly's new_leads_contacted_count). Instantly's
-- "contacted" adds up daily counts, so it isn't a count of different people; this is.
-- Safe to run more than once.
alter table spiral.instantly_range_overview add column if not exists new_contacted integer not null default 0;
