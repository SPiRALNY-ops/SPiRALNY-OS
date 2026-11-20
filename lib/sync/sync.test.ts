/**
 * End to end on embedded Postgres: every API answers from fixtures shaped like
 * the official response schemas, the sync writes the tables, and the Analytics
 * tab switches from sample to real numbers.
 */
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAnalytics } from "@/lib/analytics/build";
import { parseKey } from "@/lib/crypto";
import { openPglite } from "@/lib/db/drivers";
import { runMigrations } from "@/lib/db/migrate";
import type { Db } from "@/lib/db/types";
import { getGoogleConnection, saveGoogleConnection } from "@/lib/sources/google-account";
import { ALL_GOOGLE_SCOPES } from "@/lib/sources/google-oauth";
import type { Fetch } from "@/lib/sources/http";
import { ABANDONED_HTML, COMPLETE_TEXT } from "@/test/fixtures";
import { runSync } from "./index";
import type { SyncConfig } from "./types";

const TODAY = "2026-11-20";
const TZ = "America/New_York";
const HEX_KEY = randomBytes(32).toString("hex");

const CONFIG: SyncConfig = {
  timezone: TZ,
  encryptionKey: HEX_KEY,
  google: { clientId: "cid", clientSecret: "secret" },
  ga4PropertyId: "123456",
  gscSiteUrl: "sc-domain:spiralny.com",
  gmailQuery: 'subject:"Spiral OS entry"',
  instantlyApiKey: "inst-key",
};

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const at = (iso: string) => String(Date.parse(iso));

/** Gmail messages keyed by id. */
const MESSAGES: Record<string, object> = {
  m1: {
    id: "m1",
    internalDate: at("2026-11-10T15:00:00Z"),
    payload: {
      mimeType: "multipart/alternative",
      headers: [{ name: "Subject", value: "Spiral OS entry: complete" }],
      parts: [{ mimeType: "text/plain", body: { data: b64(COMPLETE_TEXT) } }],
    },
  },
  m2: {
    id: "m2",
    internalDate: at("2026-11-12T18:30:00Z"),
    payload: {
      mimeType: "text/html",
      headers: [{ name: "Subject", value: "Spiral OS entry: abandoned" }],
      body: { data: b64(ABANDONED_HTML) },
    },
  },
  m3: {
    id: "m3",
    internalDate: at("2026-11-13T10:00:00Z"),
    payload: {
      mimeType: "text/plain",
      headers: [{ name: "Subject", value: "Re: Spiral OS entry: complete" }],
      body: { data: b64("Thanks!\n\n> Spiral OS entry\n> Form ID: 23785") },
    },
  },
};

type World = { gmailIds: string[]; tokenStatus: number; calls: string[] };

function fakeApis(world: World): Fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    const body = typeof init?.body === "string" ? init.body : "";
    world.calls.push(`${init?.method ?? "GET"} ${url.origin}${url.pathname}`);
    const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

    if (url.href === "https://oauth2.googleapis.com/token") {
      return world.tokenStatus === 200
        ? json({ access_token: "ya29.test", expires_in: 3599, token_type: "Bearer" })
        : json({ error: "invalid_grant" }, world.tokenStatus);
    }
    if (url.pathname === "/gmail/v1/users/me/messages") return json({ messages: world.gmailIds.map((id) => ({ id })) });
    if (url.pathname.startsWith("/gmail/v1/users/me/messages/")) {
      return json(MESSAGES[decodeURIComponent(url.pathname.split("/").pop()!)]);
    }
    if (url.hostname === "searchconsole.googleapis.com") {
      const q = JSON.parse(body);
      const inRange = (d: string) => d >= q.startDate && d <= q.endDate;
      const rows =
        q.dimensions.length === 3
          ? [
              { keys: ["2026-11-10", "100 commission brokerage nyc", "https://spiralny.com/brooklyn-100-commission-brokerage/"], clicks: 4, impressions: 90, ctr: 0.04, position: 6.2 },
              { keys: ["2026-11-11", "park my real estate license ny", "https://spiralny.com/park-your-license/"], clicks: 2, impressions: 40, ctr: 0.05, position: 3.1 },
            ]
          : [
              { keys: ["2026-11-10", "https://spiralny.com/brooklyn-100-commission-brokerage/"], clicks: 5, impressions: 120, ctr: 0.04, position: 6.0 },
              { keys: ["2026-11-11", "https://spiralny.com/park-your-license/"], clicks: 3, impressions: 60, ctr: 0.05, position: 3.0 },
            ];
      return json({ rows: rows.filter((r) => inRange(r.keys[0])) });
    }
    if (url.hostname === "analyticsdata.googleapis.com") {
      const row = (date: string, page: string, sessions: number) => ({
        dimensionValues: [date, page, "Organic Search", "google", "organic", "desktop"].map((value) => ({ value })),
        metricValues: [sessions, sessions - 1, sessions].map((v) => ({ value: String(v) })),
      });
      return json({ rows: [row("20261110", "/brooklyn-100-commission-brokerage/", 30), row("20261111", "/park-your-license/", 12)], rowCount: 2 });
    }
    if (url.href.startsWith("https://api.instantly.ai/api/v2/campaigns?")) {
      return json({
        items: [
          { id: "camp-1", name: "NYC agents — 100% split", status: 1, timestamp_created: "2026-10-01T12:00:00.000Z" },
          { id: "camp-2", name: "Draft idea", status: 0, timestamp_created: "2026-11-01T12:00:00.000Z" },
        ],
      });
    }
    if (url.pathname === "/api/v2/campaigns/analytics") {
      // Instantly's own totals. Deliberately not the sum of the daily rows (10 replies, 3 opportunities):
      // a lead who replied on two days counts once here, and one opportunity was later removed.
      expect(url.searchParams.get("exclude_total_leads_count")).toBe("true");
      return json([
        { campaign_id: "camp-1", campaign_name: "NYC agents — 100% split", emails_sent_count: 410, reply_count_unique: 9, total_opportunities: 2 },
        { campaign_id: "camp-2", campaign_name: "Draft idea", emails_sent_count: 0, reply_count_unique: 0, total_opportunities: 0 },
      ]);
    }
    if (url.pathname === "/api/v2/campaigns/analytics/daily") {
      expect(url.searchParams.get("campaign_id")).toBe("camp-1");
      return json([
        { date: "2026-11-09", sent: 200, contacted: 180, unique_opened: 60, unique_replies: 6, unique_opportunities: 2 },
        { date: "2026-11-10", sent: 210, contacted: 190, unique_opened: 55, unique_replies: 4, unique_opportunities: 1 },
      ]);
    }
    if (url.pathname === "/api/v2/leads/list") {
      const { contacts } = JSON.parse(body) as { contacts: string[] };
      const items = contacts.includes("jane@example.com")
        ? [
            {
              id: "lead-1",
              email: "jane@example.com",
              campaign: "camp-1",
              status: 1,
              lt_interest_status: 1,
              timestamp_created: "2026-11-01T09:00:00.000Z",
              timestamp_last_contact: "2026-11-02T14:00:00.000Z",
              timestamp_last_reply: "2026-11-03T16:00:00.000Z",
            },
          ]
        : [];
      return json({ items });
    }
    throw new Error(`Unexpected request: ${url.href}`);
  };
}

describe("daily sync", () => {
  let db: Db;
  let world: World;

  beforeEach(async () => {
    db = await openPglite();
    await runMigrations(db, { local: true });
    world = { gmailIds: ["m1", "m2", "m3"], tokenStatus: 200, calls: [] };
  });
  afterEach(async () => db.close());

  const connectGoogle = () =>
    saveGoogleConnection(db, parseKey(HEX_KEY), {
      accountEmail: "admin@outreachify.io",
      refreshToken: "1//test-refresh",
      scopes: ALL_GOOGLE_SCOPES,
      connectedBy: "dev@localhost",
    });
  const sync = () => runSync({ db, fetch: fakeApis(world), today: TODAY, config: CONFIG });

  it("reports what is missing and writes nothing when nothing is connected", async () => {
    const results = await runSync({ db, fetch: fakeApis(world), today: TODAY, config: { ...CONFIG, instantlyApiKey: undefined } });
    expect(results.map((r) => [r.source, r.status])).toEqual([
      ["forms", "not-ready"],
      ["instantly", "not-ready"],
      ["gsc", "not-ready"],
      ["ga4", "not-ready"],
    ]);
    expect(results[0].message).toMatch(/Google isn't connected/);
    expect(await db.query("select * from spiral.sync_runs")).toHaveLength(0);
    expect(world.calls).toHaveLength(0);
  });

  it("fills every table and switches Analytics to real numbers", async () => {
    await connectGoogle();
    const results = await sync();
    expect(results.map((r) => [r.source, r.status])).toEqual([
      ["forms", "success"],
      ["instantly", "success"],
      ["gsc", "success"],
      ["ga4", "success"],
    ]);

    // Form entries: two parsed, the reply ignored; one person each.
    const entries = await db.query<{ entry_type: string; email: string; amount_cents: number | null }>(
      "select entry_type, email, amount_cents from spiral.form_entries order by received_at",
    );
    expect(entries).toEqual([
      { entry_type: "complete", email: "jane@example.com", amount_cents: 49816 },
      { entry_type: "abandoned", email: "bob@example.com", amount_cents: null },
    ]);
    const people = await db.query<{ email: string; stage: string; source: string; source_detail: string | null }>(
      "select email, stage, source, source_detail from spiral.people order by email",
    );
    expect(people).toEqual([
      { email: "bob@example.com", stage: "new", source: "website", source_detail: null },
      // Jane was added to an Instantly campaign and emailed before she filled the form.
      { email: "jane@example.com", stage: "signed", source: "cold_email", source_detail: "NYC agents — 100% split" },
    ]);

    // Search Console backfill covers ~16 months in 30-day chunks, two queries per chunk.
    const gscCalls = world.calls.filter((c) => c.includes("searchconsole")).length;
    expect(gscCalls).toBe(2 * Math.ceil(487 / 30));
    expect(await db.query("select * from spiral.gsc_daily")).toHaveLength(2);

    const view = await buildAnalytics(db, "28d", TODAY, TZ);
    expect(view.sources.every((s) => s.origin === "real")).toBe(true);
    const kpi = Object.fromEntries(view.kpis.map((k) => [k.key, [k.value, k.origin]]));
    expect(kpi).toEqual({
      leads: [2, "real"],
      signups: [1, "real"],
      unfinished: [1, "real"],
      visits: [42, "real"],
      googleClicks: [8, "real"],
      replies: [9, "real"], // Instantly's own total, not the 10 from adding up days
    });
    const leadTotals = view.leadsBySource.buckets.reduce(
      (t, b) => ({ cold: t.cold + b.cold_email, unknown: t.unknown + b.unknown }),
      { cold: 0, unknown: 0 },
    );
    expect(leadTotals).toEqual({ cold: 1, unknown: 1 });
    const brooklyn = view.pages.rows.find((r) => r.path === "/brooklyn-100-commission-brokerage/");
    expect(brooklyn).toMatchObject({ visits: 30, googleClicks: 5, leads: 1, signups: 1 });
    expect(view.coldEmail.rows).toEqual([
      expect.objectContaining({ id: "camp-1", sent: 410, replies: 9, interested: 2, leads: 1, signups: 1 }),
    ]);
  });

  it("is safe to run again: no duplicates, recent days re-read", async () => {
    await connectGoogle();
    await sync();
    world.calls = [];
    await sync();
    expect(await db.query("select * from spiral.form_entries")).toHaveLength(2);
    expect(await db.query("select * from spiral.instantly_campaign_daily")).toHaveLength(2);
    expect(await db.query("select * from spiral.gsc_daily_page")).toHaveLength(2);
    // Instantly totals are replaced, not piled up: 4 ranges + the period before each = 8 periods x 2 campaigns.
    expect(await db.query("select * from spiral.instantly_range_totals")).toHaveLength(16);
    // Each email is looked up in Instantly once.
    expect(world.calls.filter((c) => c.includes("/leads/list"))).toHaveLength(0);
    // The second Search Console run only re-reads the last few days.
    expect(world.calls.filter((c) => c.includes("searchconsole"))).toHaveLength(2);
  });

  it("keeps sample data while a connected source has nothing to show", async () => {
    await connectGoogle();
    world.gmailIds = [];
    const results = await runSync({ db, fetch: fakeApis(world), today: TODAY, config: CONFIG }, ["forms"]);
    expect(results).toEqual([expect.objectContaining({ source: "forms", status: "skipped" })]);
    const view = await buildAnalytics(db, "28d", TODAY, TZ);
    expect(view.sources.find((s) => s.key === "forms")?.origin).toBe("sample");
  });

  it("records revoked Google access so the panel can ask for a reconnect", async () => {
    await connectGoogle();
    world.tokenStatus = 400;
    const results = await runSync({ db, fetch: fakeApis(world), today: TODAY, config: CONFIG }, ["gsc"]);
    expect(results[0]).toMatchObject({ source: "gsc", status: "error", message: expect.stringMatching(/Reconnect Google/) });
    expect((await getGoogleConnection(db))?.lastError).toMatch(/Reconnect Google/);
    const [run] = await db.query<{ status: string }>("select status from spiral.sync_runs");
    expect(run.status).toBe("error");
  });
});
