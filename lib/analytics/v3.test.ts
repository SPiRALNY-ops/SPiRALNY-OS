import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openPglite } from "@/lib/db/drivers";
import { runMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";
import { acquireLease, releaseLease } from "@/lib/sync/lease";
import { dueSourcesIn } from "@/lib/sync/server";
import { searchDeep } from "./deep";
import { DATA_VERSION_SQL } from "./index";
import { findings, topFindings } from "./insights";
import { monthPoints } from "./long";
import type { AnalyticsView, LongView } from "./types";

let db: Db;
beforeEach(async () => {
  db = await openPglite();
  await runMigrations(db, { local: true });
});
afterEach(async () => {
  await db.close();
});

describe("months", () => {
  it("say where the data starts inside a month, and which month isn't over", () => {
    const months = monthPoints("2026-11-24", 3, "2026-09-05");
    expect(months.map((m) => [m.key, m.partial, m.starts ?? null])).toEqual([
      ["2026-09", true, "2026-09-05"], // the data starts on the 5th
      ["2026-10", false, null],
      ["2026-11", true, null], // not over yet
    ]);
  });
});

describe("deeper search numbers", () => {
  const row = (query: string, page: string, position: number, impressions: number, clicks = 0) =>
    db.query("insert into spiral.gsc_daily (day, query, page, clicks, impressions, position) values ('2026-11-10', $1, $2, $3, $4, $5)", [
      query,
      page,
      clicks,
      impressions,
      position,
    ]);

  it("finds recruiting searches near page one, and pages competing as separate results (not sitelinks)", async () => {
    // Two pages at the same position are one result (sitelinks); a third further down is a second result.
    await row("100 commission brokerage", "https://spiralny.com/", 12, 30);
    await row("100 commission brokerage", "https://spiralny.com/about/", 12.2, 20);
    await row("100 commission brokerage", "https://spiralny.com/100-commission-brokerage/", 18, 15);
    // Sitelinks only: not competing.
    await row("nyc broker", "https://spiralny.com/", 9, 12);
    await row("nyc broker", "https://spiralny.com/join-our-team/", 9.1, 11);
    // A brand search at the top: not an opportunity.
    await row("spiral ny", "https://spiralny.com/", 1, 100, 10);
    await row("how do i park my real estate license in new york", "https://spiralny.com/park-your-license-and-stay-active/", 25, 8);

    const deep = await searchDeep(db, { start: "2026-11-01", end: "2026-11-30" }, null);
    expect(deep.opportunities.rows.map((r) => r.query)).toEqual(["100 commission brokerage", "nyc broker"]);
    expect(deep.opportunities.rows[0].path).toBe("/"); // the page Google showed most
    expect(deep.competing.rows.map((r) => [r.query, r.pages.map((p) => p.path)])).toEqual([
      ["100 commission brokerage", ["/", "/100-commission-brokerage/"]],
    ]);
    expect(deep.positions.find((p) => p.key === "top3")).toMatchObject({ clicks: 10, impressions: 100 });
    expect(deep.movers).toBeNull(); // no period before to compare with
    expect(deep.namedClicks).toBe(10);
  });
});

describe("findings", () => {
  const view = (over: Partial<Record<string, unknown>> = {}) =>
    ({
      range: { key: "28d", label: "Last 28 days", start: "2026-10-30" },
      coverage: { ga4: "2026-11-20" },
      kpis: [
        { key: "signups", value: 8, previous: 8, origin: "real" },
        { key: "googleClicks", value: 400, previous: 520, origin: "real" },
      ],
      signupsBySource: { origin: "real", buckets: [{ google: 1, referral: 0, cold_email: 1, unknown: 6 }] },
      searches: {
        origin: "real",
        deep: {
          opportunities: { rows: [], total: 77, impressions: 2198, clicks: 2 },
          competing: { rows: [], total: 27, recruiting: 14 },
          movers: { pages: [{ key: "/park-your-license-and-stay-active/", label: "/park-your-license-and-stay-active/", group: "recruiting", now: 5, before: 15 }], searches: [] },
        },
      },
      website: { origin: "real", sessions: 600, sources: [{ label: "Direct", kind: "Direct", sessions: 470 }, { label: "ChatGPT", kind: "AI assistant", sessions: 7 }] },
      coldEmail: { origin: "real", health: { sent: 10_000, bounced: 600, newContacted: 0, autoReplies: 0 } },
      ...over,
    }) as unknown as AnalyticsView;
  const long = {
    leads: {
      health: { leadRows: 373, noDate: 183, noPlan: 0, noSource: 0, signups: 42, signupsNoSource: 23 },
      onboarding: { signed: 42, associated: 38, whatsapp: 21, withdrew: 4, notAssociated: 2, notWhatsapp: 19 },
    },
    cold: {
      months: [
        { label: "Aug ’26", sent: 3218, replies: 74, partial: false },
        { label: "Sep ’26", sent: 10819, replies: 181, partial: false },
        { label: "Oct ’26", sent: 21677, replies: 218, partial: false },
        { label: "Nov ’26", sent: 17866, replies: 67, partial: true },
      ],
    },
  } as unknown as LongView;

  it("turns the numbers into plain findings, most urgent first", () => {
    const all = findings(view(), long);
    const ids = all.map((f) => `${f.severity}:${f.id}`);
    expect(ids).toEqual([
      "fix:sheet-undated",
      "fix:cold-bounces", // 6% bounced
      "watch:signups-unknown", // 6 of 8
      "watch:onboarding-pending",
      "watch:search-competing",
      "watch:search-page-falling", // lost 67%
      "watch:search-clicks-change", // -23%
      "watch:website-direct", // 78%
      "watch:cold-reply-drop", // 2.3% (Aug) to 1.0% (Oct); November isn't over, so it isn't compared
      "opportunity:search-opportunities",
      "good:website-ai",
    ]);
    expect(all.find((f) => f.id === "cold-reply-drop")!.title).toBe("Cold email reply rate fell from 2.3% to 1.0%");
    expect(all.find((f) => f.id === "cold-bounces")!.title).toBe("6.0% of cold emails bounced");
    // Google Analytics started inside the period: say since when, not "in the last 28 days".
    expect(all.find((f) => f.id === "website-ai")!.detail).toContain("since Nov 20");
    expect(all.find((f) => f.id === "search-page-falling")!.href).toContain("item=page%3A%2Fpark-your-license-and-stay-active%2F");
  });

  it("keeps the Overview short: five at most, two per area", () => {
    const top = topFindings(findings(view(), long));
    expect(top).toHaveLength(5);
    const perArea = top.reduce<Record<string, number>>((acc, f) => ({ ...acc, [f.area]: (acc[f.area] ?? 0) + 1 }), {});
    expect(Math.max(...Object.values(perArea))).toBeLessThanOrEqual(2);
  });

  it("stays quiet when nothing crosses a threshold", () => {
    const calm = findings(
      view({
        kpis: [{ key: "googleClicks", value: 500, previous: 520, origin: "real" }],
        signupsBySource: { origin: "real", buckets: [{ google: 3, referral: 1, cold_email: 2, unknown: 1 }] },
        searches: { origin: "real", deep: { opportunities: { total: 2 }, competing: { recruiting: 1 }, movers: { pages: [] } } },
        website: { origin: "real", sessions: 600, sources: [{ label: "Direct", kind: "Direct", sessions: 200 }] },
        coldEmail: { origin: "real", health: { sent: 10_000, bounced: 100 } },
      }),
      { leads: null, cold: null } as unknown as LongView,
    );
    expect(calm).toEqual([]);
  });
});

describe("coverage", () => {
  it("dates sign-ups from the first sign-up, not the first lead", async () => {
    const { coverage } = await import("./details");
    await db.query(
      `insert into spiral.lead_sheet_rows (tab, row_number, kind, day, email) values
         ('FWD/FRESH', 2, 'lead', '2026-05-05', 'a@example.com'),
         ('SIGNED!', 2, 'signup', '2026-07-27', 'b@example.com')`,
    );
    const c = await coverage(db, "America/New_York");
    expect(c).toMatchObject({ leads: "2026-05-05", signups: "2026-07-27" });
  });
});

describe("sync bookkeeping", () => {
  it("lets one sync hold the lease at a time, and frees it when done", async () => {
    const first = await acquireLease(db);
    expect(first).not.toBeNull();
    expect(await acquireLease(db)).toBeNull(); // another server during a deploy
    await releaseLease(db, first!);
    expect(await acquireLease(db)).not.toBeNull();
  });

  it("runs only the sources today's morning sync hasn't finished", async () => {
    const all = ["forms", "lead_sheet", "instantly", "gsc", "ga4"] as const;
    // Hour 0: "past the morning hour" is always true, so only today's runs matter.
    const due = () => dueSourcesIn(db, { timezone: "America/New_York", hour: 0, ready: [...all].filter((s) => s !== "ga4") });
    expect(await due()).toEqual(["forms", "lead_sheet", "instantly", "gsc"]); // ga4 isn't set up: never due
    await db.query("insert into spiral.sync_runs (source, status, finished_at) values ('forms', 'success', now()), ('lead_sheet', 'error', now())");
    await db.query("insert into spiral.sync_runs (source, status) values ('instantly', 'running')"); // cut off by a deploy
    expect(await due()).toEqual(["instantly", "gsc"]); // an error counts as tried; a run left running doesn't
  });

  it("changes the data version only when a sync step finishes", async () => {
    const version = async () => (await db.query<{ v: string }>(DATA_VERSION_SQL))[0].v;
    const before = await version();
    const [run] = await db.query<{ id: number }>("insert into spiral.sync_runs (source, status) values ('gsc', 'running') returning id");
    expect(await version()).toBe(before); // a step in progress doesn't clear the cache
    await db.query("update spiral.sync_runs set status = 'success', finished_at = now() where id = $1", [run.id]);
    expect(await version()).not.toBe(before);
  });
});
