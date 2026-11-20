import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openPglite } from "@/lib/db/drivers";
import { runMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";
import { buildAnalytics } from "./build";
import { eachDay, resolveRange, todayIn } from "./range";
import { sampleBySource, sampleKpis } from "./sample";
import { LEAD_SOURCES } from "./types";

const TZ = "America/New_York";
const TODAY = "2026-11-20";

describe("date ranges", () => {
  it("end yesterday and compare against the period just before", () => {
    const r = resolveRange("28d", TODAY);
    expect(r).toMatchObject({ start: "2026-10-23", end: "2026-11-19", previousStart: "2026-09-25", previousEnd: "2026-10-22" });
    expect(r.buckets).toHaveLength(28);
  });

  it("cover every day exactly once with week and month buckets", () => {
    for (const key of ["90d", "12m"] as const) {
      const r = resolveRange(key, TODAY);
      expect(r.buckets[0].start).toBe(r.start);
      expect(r.buckets.at(-1)!.end).toBe(r.end);
      const covered = r.buckets.flatMap((b) => eachDay(b.start, b.end));
      expect(covered).toEqual(eachDay(r.start, r.end));
    }
    expect(resolveRange("90d", TODAY).buckets.length).toBeLessThanOrEqual(14);
    expect(resolveRange("12m", TODAY).buckets.length).toBeLessThanOrEqual(13);
  });

  it("uses New York's calendar date", () => {
    // 03:30 UTC on Nov 21 is still Nov 20 in New York.
    expect(todayIn(TZ, new Date("2026-11-21T03:30:00Z"))).toBe("2026-11-20");
  });
});

describe("sample data", () => {
  it("is stable and adds up", () => {
    const r = resolveRange("90d", TODAY);
    expect(sampleKpis(r)).toEqual(sampleKpis(r));
    const leads = sampleKpis(r).find((k) => k.key === "leads")!.value;
    const bucketTotal = sampleBySource(r, "leads").reduce(
      (s, b) => s + LEAD_SOURCES.reduce((t, k) => t + b[k], 0),
      0,
    );
    expect(bucketTotal).toBe(leads);
  });

  it("gives every number a trend that adds up to it, one point per bucket", () => {
    for (const key of ["7d", "28d", "90d", "12m"] as const) {
      const r = resolveRange(key, TODAY);
      const kpis = sampleKpis(r);
      for (const k of kpis) {
        expect(k.trend).toHaveLength(r.buckets.length);
        expect(k.trend.reduce((a, b) => a + b, 0)).toBe(k.value);
      }
      const v = (key: string) => kpis.find((k) => k.key === key)!.value;
      // Same definition as the real numbers: started a form but never completed one.
      expect(v("unfinished")).toBe(v("leads") - v("signups"));
    }
  });
});

describe("buildAnalytics", () => {
  let db: Db;
  beforeEach(async () => {
    db = await openPglite();
    await runMigrations(db, { local: true });
  });
  afterEach(async () => db.close());

  it("shows sample data everywhere before any source has synced", async () => {
    const view = await buildAnalytics(db, "28d", TODAY, TZ);
    expect(view.sources.every((s) => s.origin === "sample")).toBe(true);
    expect(view.kpis.every((k) => k.origin === "sample")).toBe(true);
    expect([view.leadsBySource, view.pages, view.searches, view.coldEmail].every((s) => s.origin === "sample")).toBe(true);
  });

  it("switches each section to real data once its source syncs", async () => {
    await db.exec(`
      insert into spiral.sync_runs (source, status, finished_at) values
        ('forms', 'success', now()), ('gsc', 'success', now());
      insert into spiral.people (id, email, source) values
        ('11111111-1111-1111-1111-111111111111', 'cold@example.com', 'cold_email'),
        ('22222222-2222-2222-2222-222222222222', 'web@example.com', 'unknown');
      insert into spiral.form_entries (gmail_message_id, entry_type, received_at, email, page_url, person_id) values
        ('m1', 'abandoned', '2026-11-10T15:00:00Z', 'cold@example.com', 'https://spiralny.com/100-commission-brokerage/', '11111111-1111-1111-1111-111111111111'),
        ('m2', 'complete',  '2026-11-11T15:00:00Z', 'cold@example.com', 'https://spiralny.com/100-commission-brokerage/', '11111111-1111-1111-1111-111111111111'),
        ('m3', 'abandoned', '2026-11-12T15:00:00Z', 'web@example.com',  'https://spiralny.com/join-our-team/', '22222222-2222-2222-2222-222222222222'),
        ('m4', 'complete',  '2026-09-01T15:00:00Z', 'old@example.com',  'https://spiralny.com/', null);
      insert into spiral.gsc_daily_page (day, page, clicks, impressions, position) values
        ('2026-11-10', 'https://spiralny.com/100-commission-brokerage/', 12, 300, 6.5),
        ('2026-11-11', 'https://spiralny.com/', 5, 200, 3.0);
      insert into spiral.gsc_daily (day, query, page, clicks, impressions, position) values
        ('2026-11-10', '100 commission brokerage ny', 'https://spiralny.com/100-commission-brokerage/', 9, 200, 5.0),
        ('2026-11-10', 'no split brokerage', 'https://spiralny.com/100-commission-brokerage/', 3, 100, 9.5);
    `);

    const view = await buildAnalytics(db, "28d", TODAY, TZ);
    const kpi = (key: string) => view.kpis.find((k) => k.key === key)!;

    expect(kpi("leads")).toMatchObject({ origin: "real", value: 2 });
    expect(kpi("signups")).toMatchObject({ origin: "real", value: 1 });
    expect(kpi("unfinished")).toMatchObject({ origin: "real", value: 1 });
    expect(kpi("googleClicks")).toMatchObject({ origin: "real", value: 17 });
    expect(kpi("visits").origin).toBe("sample"); // GA4 not synced yet

    // Trend lines add up to their numbers. Someone who started on Nov 10 and finished on
    // Nov 11 is not "unfinished" on either day, so that line never dips below zero.
    const at = (key: string, day: string) => kpi(key).trend[view.range.buckets.findIndex((b) => b.key === day)];
    for (const key of ["leads", "signups", "unfinished", "googleClicks"]) {
      expect(kpi(key).trend.reduce((a, b) => a + b, 0)).toBe(kpi(key).value);
      expect(kpi(key).trend.every((n) => n >= 0)).toBe(true);
    }
    expect([at("leads", "2026-11-10"), at("leads", "2026-11-12")]).toEqual([1, 1]);
    expect([at("unfinished", "2026-11-10"), at("unfinished", "2026-11-12")]).toEqual([0, 1]);
    expect(at("googleClicks", "2026-11-10")).toBe(12);
    expect(kpi("replies").origin).toBe("sample");

    // Each person counted once, in the bucket of their first entry, under their source.
    const leadBuckets = view.leadsBySource.buckets;
    expect(leadBuckets.find((b) => b.key === "2026-11-10")?.cold_email).toBe(1);
    expect(leadBuckets.find((b) => b.key === "2026-11-11")?.cold_email).toBe(0);
    expect(leadBuckets.find((b) => b.key === "2026-11-12")?.unknown).toBe(1);
    expect(view.signupsBySource.buckets.find((b) => b.key === "2026-11-11")?.cold_email).toBe(1);

    const page = view.pages.rows.find((r) => r.path === "/100-commission-brokerage/")!;
    expect(view.pages.origin).toBe("real");
    expect(page).toMatchObject({ googleClicks: 12, leads: 1, signups: 1, visits: null });
    expect(page.topSearches[0]).toMatchObject({ query: "100 commission brokerage ny", clicks: 9 });

    expect(view.searches.daily).toHaveLength(28);
    expect(view.searches.rows[0]).toMatchObject({ query: "100 commission brokerage ny", clicks: 9 });
    expect(view.coldEmail.origin).toBe("sample");
  });
});
