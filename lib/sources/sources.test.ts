import { createHash, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, parseKey } from "@/lib/crypto";
import { fetchGa4Daily, ga4Date } from "./ga4";
import { readMessage, htmlToText, type GmailMessage } from "./gmail";
import { buildAuthUrl, exchangeCode, GoogleReconnectNeeded, pkcePair, refreshAccessToken } from "./google-oauth";
import { fetchGscRows } from "./gsc";
import { requestJson, type Fetch } from "./http";
import { findLeadsByEmail, listCampaigns } from "./instantly";
import { SPIRAL_FORMS, normalizePhone, notificationMessage, parseAmountCents, parseSpiralEntry } from "./wpforms-email";
import { ABANDONED_HTML, COMPLETE_TEXT, LEAD_SHEET_TABS_FIXTURE } from "@/test/fixtures";
import { normalizePlan, parseLeadSheetTab, parseSheetDate, sourceFromHowFound, sourceFromSignupNote, tabRule } from "./lead-sheet";
import { readTabs } from "./sheets";
import { pickSpiralSite } from "./gsc";

type Call = { url: string; method: string; body: string | undefined; headers: Record<string, string> };

/** A fetch that records calls and answers from a handler. */
function fakeFetch(handler: (call: Call) => { status?: number; json?: unknown; headers?: Record<string, string> }) {
  const calls: Call[] = [];
  const fn: Fetch = async (input, init) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>,
    };
    calls.push(call);
    const r = handler(call);
    return new Response(r.json === undefined ? "" : JSON.stringify(r.json), {
      status: r.status ?? 200,
      headers: r.headers,
    });
  };
  return { fn, calls };
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("crypto", () => {
  const key = parseKey(randomBytes(32).toString("hex"));

  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("1//refresh-token", key);
    expect(decrypt(a, key)).toBe("1//refresh-token");
    expect(encrypt("1//refresh-token", key)).not.toBe(a);
    expect(a).not.toContain("refresh-token");
  });

  it("rejects tampering, the wrong key and malformed keys", () => {
    const a = encrypt("secret", key);
    const parts = a.split(".");
    parts[3] = Buffer.from("XXXXXX").toString("base64url");
    expect(() => decrypt(parts.join("."), key)).toThrow();
    expect(() => decrypt(a, parseKey(randomBytes(32).toString("hex")))).toThrow();
    expect(() => parseKey("abc")).toThrow(/64 hex/);
    expect(() => parseKey(undefined)).toThrow();
  });
});

describe("http", () => {
  it("retries rate limits, then returns JSON", async () => {
    let n = 0;
    const { fn, calls } = fakeFetch(() => (++n < 3 ? { status: 429, json: { error: "slow down" } } : { json: { ok: 1 } }));
    const res = await requestJson<{ ok: number }>(fn, "https://x.test/a", { service: "X", backoffMs: () => 0 });
    expect(res.ok).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it("does not retry client errors", async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 403, json: { error: "forbidden" } }));
    await expect(requestJson(fn, "https://x.test/a", { service: "X", backoffMs: () => 0 })).rejects.toThrow(/X returned HTTP 403/);
    expect(calls).toHaveLength(1);
  });
});

describe("Google OAuth", () => {
  it("builds a consent URL that asks for offline access with PKCE", () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const url = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://os.test/api/google/callback", state: "st", codeChallenge: challenge }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
    expect(p.get("scope")!.split(" ")).toEqual(
      expect.arrayContaining([
        "openid",
        "email",
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/webmasters.readonly",
        "https://www.googleapis.com/auth/gmail.readonly",
      ]),
    );
  });

  it("exchanges the code with the verifier, and flags revoked access", async () => {
    const { fn, calls } = fakeFetch(() => ({ json: { access_token: "at", expires_in: 3599, refresh_token: "rt", token_type: "Bearer" } }));
    const res = await exchangeCode(fn, { clientId: "cid", clientSecret: "sec" }, { code: "c0de", codeVerifier: "v", redirectUri: "https://os.test/cb" });
    expect(res.refresh_token).toBe("rt");
    expect(calls[0].url).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
      client_id: "cid",
      client_secret: "sec",
      code: "c0de",
      code_verifier: "v",
      grant_type: "authorization_code",
      redirect_uri: "https://os.test/cb",
    });

    const revoked = fakeFetch(() => ({ status: 400, json: { error: "invalid_grant", error_description: "Token has been expired or revoked." } }));
    await expect(refreshAccessToken(revoked.fn, { clientId: "cid", clientSecret: "sec" }, "rt")).rejects.toBeInstanceOf(GoogleReconnectNeeded);
  });
});

describe("Google Analytics", () => {
  it("converts dates, pages through results and merges duplicate keys", async () => {
    expect(ga4Date("20261119")).toBe("2026-11-19");
    const row = (date: string, page: string, sessions: string) => ({
      dimensionValues: [date, page, "Organic Search", "google", "organic", "mobile"].map((value) => ({ value })),
      metricValues: [sessions, "1", "1"].map((value) => ({ value })),
    });
    const { fn, calls } = fakeFetch(() => ({
      json: { rows: [row("20261118", "/join/", "3"), row("20261118", "/join/", "2"), row("20261119", "", "4")], rowCount: 3 },
    }));
    const rows = await fetchGa4Daily(fn, "at", "123456", "2026-11-18", "2026-11-19");
    expect(calls[0].url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456:runReport");
    expect(calls[0].headers.authorization).toBe("Bearer at");
    const body = JSON.parse(calls[0].body!);
    expect(body.dimensions.map((d: { name: string }) => d.name)).toEqual([
      "date",
      "landingPage",
      "sessionDefaultChannelGroup",
      "sessionSource",
      "sessionMedium",
      "deviceCategory",
    ]);
    expect(body.metrics.map((m: { name: string }) => m.name)).toEqual(["sessions", "engagedSessions", "totalUsers"]);
    expect(rows).toEqual([
      expect.objectContaining({ day: "2026-11-18", landing_page: "/join/", sessions: 5 }),
      expect.objectContaining({ day: "2026-11-19", landing_page: "(not set)", sessions: 4 }),
    ]);
  });
});

describe("Search Console", () => {
  it("pages with startRow until a short page", async () => {
    const full = Array.from({ length: 25_000 }, (_, i) => ({ keys: ["2026-11-01", `q${i}`], clicks: 1, impressions: 2, ctr: 0.5, position: 3 }));
    const { fn, calls } = fakeFetch((c) => {
      const body = JSON.parse(c.body!);
      return { json: { rows: body.startRow === 0 ? full : full.slice(0, 10) } };
    });
    const rows = await fetchGscRows(fn, "at", "sc-domain:spiralny.com", "2026-11-01", "2026-11-01", ["date", "query"]);
    expect(rows).toHaveLength(25_010);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe(
      "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aspiralny.com/searchAnalytics/query",
    );
    expect(JSON.parse(calls[1].body!)).toMatchObject({ startRow: 25_000, rowLimit: 25_000, type: "web" });
  });
});

describe("Instantly", () => {
  it("follows next_starting_after for campaigns", async () => {
    const { fn, calls } = fakeFetch((c) =>
      c.url.includes("starting_after=c2")
        ? { json: { items: [{ id: "c3", name: "C", status: 1 }] } }
        : { json: { items: [{ id: "c1", name: "A", status: 1 }, { id: "c2", name: "B", status: 2 }], next_starting_after: "c2" } },
    );
    const campaigns = await listCampaigns(fn, "key");
    expect(campaigns.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(calls[0].url).toBe("https://api.instantly.ai/api/v2/campaigns?limit=100");
    expect(calls[0].headers.authorization).toBe("Bearer key");
  });

  it("looks leads up by email in batches of 50", async () => {
    const emails = Array.from({ length: 120 }, (_, i) => `p${i}@example.com`);
    const { fn, calls } = fakeFetch((c) => {
      const body = JSON.parse(c.body!);
      return { json: { items: [{ id: `l-${body.contacts[0]}`, email: body.contacts[0], campaign: "c1" }] } };
    });
    const leads = await findLeadsByEmail(fn, "key", emails);
    expect(calls.map((c) => JSON.parse(c.body!).contacts.length)).toEqual([50, 50, 20]);
    expect(calls[0].url).toBe("https://api.instantly.ai/api/v2/leads/list");
    expect(leads).toHaveLength(3);
  });
});

describe("WPForms notification emails", () => {
  it("reads a completed entry", () => {
    expect(parseSpiralEntry("Spiral OS entry: complete", COMPLETE_TEXT)).toEqual({
      entryType: "complete",
      formId: 23785,
      formName: "100% Commission Sign Up",
      entryId: "1450",
      pageUrl: "https://spiralny.com/brooklyn-100-commission-brokerage/?utm_source=google",
      fullName: "Jane Doe",
      email: "jane@example.com",
      phone: "6465550199",
      licenseNumber: "10401234567",
      plan: "100% Plan",
      amountCents: 49816,
      fields: expect.objectContaining({ "form id": "23785", all_fields: "Name\nJane Doe" }),
    });
  });

  it("reads an abandoned entry from the HTML email", () => {
    const entry = parseSpiralEntry("Spiral OS entry: abandoned", htmlToText(ABANDONED_HTML));
    expect(entry).toMatchObject({
      entryType: "abandoned",
      formId: 25662,
      email: "bob@example.com",
      phone: "9175550134",
      pageUrl: "https://spiralny.com/park-your-license/",
      licenseNumber: null,
      plan: null,
      amountCents: null,
    });
  });

  it("ignores replies, other emails and unfilled smart tags", () => {
    expect(parseSpiralEntry("Re: Spiral OS entry: complete", COMPLETE_TEXT)).toBeNull();
    expect(parseSpiralEntry("Your invoice", "Hello\nTotal: $10")).toBeNull();
    const wrongField = COMPLETE_TEXT.replace("Email: jane@example.com", 'Email: {field_id="9"}').replace("Name\nJane Doe", "");
    expect(parseSpiralEntry("Spiral OS entry: complete", wrongField)?.email).toBeNull();
  });

  it("reads every form's real notification once WPForms fills in the smart tags", () => {
    // What WPForms would put in each smart tag for one entry on each form.
    const filled: Record<string, string> = {
      "{form_id}": "",
      "{form_name}": "Sign up",
      "{entry_id}": "77",
      "{page_url}": "https://spiralny.com/x/",
      '{field_id="1"}': "Jane Doe",
      '{field_id="2"}': "Jane@Example.com",
      '{field_id="3"}': "(646) 555-0199",
      '{field_id="4"}': "10401234567",
      '{field_id="22"}': "Platinum 100% Commission Package - $498.16",
      '{field_id="15"}': "$758.16",
      "{all_fields}": "Legal Name\nJane Doe",
    };
    for (const form of SPIRAL_FORMS) {
      for (const type of ["complete", "abandoned"] as const) {
        let text = notificationMessage(form, type);
        for (const [tag, value] of Object.entries(filled)) text = text.replaceAll(tag, tag === "{form_id}" ? String(form.id) : value);
        expect(text).not.toMatch(/\{[a-z_]+(="\d+")?\}/); // every smart tag in the message is one we fill
        const entry = parseSpiralEntry(`Spiral OS entry: ${type}`, text);
        expect(entry).toMatchObject({ entryType: type, formId: form.id, email: "jane@example.com", phone: "6465550199", amountCents: 75816 });
        expect(entry?.plan).toBe(form.id === 23785 || form.id === 24913 ? "Platinum 100% Commission Package - $498.16" : form.plan);
      }
    }
  });

  it("normalises phones and amounts", () => {
    expect(normalizePhone("1-917-555-0134")).toBe("9175550134");
    expect(normalizePhone("12")).toBeNull();
    expect(parseAmountCents("$1,234.5 USD")).toBe(123450);
    expect(parseAmountCents("free")).toBeNull();
  });
});

describe("Gmail messages", () => {
  it("prefers the plain-text part inside nested multipart", () => {
    const msg: GmailMessage = {
      id: "m1",
      internalDate: String(Date.parse("2026-11-10T15:00:00Z")),
      payload: {
        mimeType: "multipart/mixed",
        headers: [{ name: "Subject", value: "Spiral OS entry: complete" }],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: b64(COMPLETE_TEXT.replaceAll("\n", "\r\n")) } },
              { mimeType: "text/html", body: { data: b64("<p>html</p>") } },
            ],
          },
        ],
      },
    };
    const r = readMessage(msg);
    expect(r.subject).toBe("Spiral OS entry: complete");
    expect(r.receivedAt.toISOString()).toBe("2026-11-10T15:00:00.000Z");
    expect(r.text).toBe(COMPLETE_TEXT);
  });

  it("falls back to the HTML part", () => {
    const r = readMessage({ id: "m2", payload: { mimeType: "text/html", body: { data: b64(ABANDONED_HTML) } } });
    expect(r.text.split("\n").slice(0, 3)).toEqual(["Spiral OS entry", "Type: abandoned", "Form ID: 25662"]);
    expect(r.text).not.toContain("margin");
  });
});

describe("lead sheet", () => {
  it("reads the tabs that hold leads and sign-ups, and skips prospect lists", () => {
    expect(["SIGNED!", "FWD/FRESH", "Instantly", "SEO", "Cold-calling "].every((t) => tabRule(t))).toBe(true);
    expect(["BROKER LEADS", "School leads", "Copy of School leads", "Sheet7"].some((t) => tabRule(t))).toBe(false);
  });

  it("parses dates as the sheet stores them", () => {
    expect(parseSheetDate(46340)).toBe("2026-11-14"); // a real date cell, as a serial number
    expect(parseSheetDate("July 30, 2026")).toBe("2026-07-30");
    expect(parseSheetDate("Sept 3, 2026")).toBe("2026-09-03");
    expect(parseSheetDate("7/28/2026")).toBe("2026-07-28");
    expect(parseSheetDate("-")).toBeNull();
  });

  it("maps each tab's columns by header", () => {
    const signed = parseLeadSheetTab("SIGNED!", LEAD_SHEET_TABS_FIXTURE["SIGNED!"]);
    expect(signed).toEqual([
      expect.objectContaining({ kind: "signup", day: "2026-11-11", fullName: "Jane Doe", email: "jane@example.com", phone: "6465550199", plan: "100%", howFound: null, source: "unknown", rowNumber: 2 }),
      expect.objectContaining({ kind: "signup", day: "2026-11-14", fullName: "Sam Lee", plan: "Park Your License", licenseNumber: "40DE0000001" }),
    ]);
    // The notes column ("Referral to 90%") is a plan change, not a referral source.
    expect(signed.map((r) => [r.associated, r.whatsapp, r.withdrew])).toEqual([
      [true, true, false],
      [true, false, false],
    ]);

    const fresh = parseLeadSheetTab("FWD/FRESH", LEAD_SHEET_TABS_FIXTURE["FWD/FRESH"]);
    expect(fresh).toHaveLength(2); // the empty row is skipped
    expect(fresh[0]).toMatchObject({ kind: "lead", day: "2026-11-13", email: "pat@example.com", phone: "6315550102", status: "Interested", plan: "90%", howFound: "Google search", source: "google" });
    expect(fresh[1]).toMatchObject({ day: null, email: "undated@example.com", rowNumber: 4 });

    const instantly = parseLeadSheetTab("Instantly", LEAD_SHEET_TABS_FIXTURE.Instantly);
    expect(instantly[0]).toMatchObject({ day: "2026-11-05", email: "lee@example.com", plan: "Park Your License", source: "cold_email" });
  });

  it("reads a source from SIGNED! notes only when the note starts with one clear source", () => {
    // The phrasings found on the real sheet (2026-11-27), plus team notes that must not count.
    const notes: [string, string | null][] = [
      ["Email", "cold_email"],
      ["Emails and calls", "cold_email"],
      ["Email and calls", "cold_email"],
      ["Emails and virtual meeting", "cold_email"],
      ["Email - withdrew association", "cold_email"],
      ["Instantly", "cold_email"],
      ["SEO", "google"],
      ["SEO / withdrew his association", "google"],
      ["Referred by a colleague", "referral"],
      ["Student leads/SEO", null], // two sources named
      ["Referral to 90%", null], // a plan change
      ["From 90% to Park your license / no payment", null],
      ["Do not contact again. Remove from all emails.", null], // an instruction
      ["Withdrew her association", null],
      ["Recruiter", null],
      ["", null],
    ];
    expect(notes.map(([n]) => sourceFromSignupNote(n))).toEqual(notes.map(([, s]) => s));
  });

  it("normalises plans and answers to \"How did you find us?\"", () => {
    expect(["Platinum 100% Commission", "Premium 90%", "Referral Agent", "Park Your License", "Unknown"].map(normalizePlan)).toEqual([
      "100%",
      "90%",
      "Referral",
      "Park Your License",
      null,
    ]);
    // Cells formatted as percentages arrive as fractions.
    expect([1, 0.9, "0.9"].map(normalizePlan)).toEqual(["100%", "90%", "90%"]);
    expect(["Google", "A friend referred me", "Your email", "Craigslist", ""].map(sourceFromHowFound)).toEqual([
      "google",
      "referral",
      "cold_email",
      null,
      null,
    ]);
  });

  it("asks Sheets for whole tabs, unformatted, in one call", async () => {
    const { fn, calls } = fakeFetch(() => ({ json: { valueRanges: [{ values: [["a"]] }, {}] } }));
    const tabs = await readTabs(fn, "at", "sheet-id", ["SIGNED!", "Owner's tab"]);
    const url = new URL(calls[0].url);
    expect(url.pathname).toBe("/v4/spreadsheets/sheet-id/values:batchGet");
    expect(url.searchParams.getAll("ranges")).toEqual(["'SIGNED!'", "'Owner''s tab'"]);
    expect(url.searchParams.get("valueRenderOption")).toBe("UNFORMATTED_VALUE");
    expect(url.searchParams.get("dateTimeRenderOption")).toBe("SERIAL_NUMBER");
    expect(tabs).toEqual({ "SIGNED!": [["a"]], "Owner's tab": [] });
  });
});

describe("Search Console property", () => {
  it("prefers the domain property, then the https site, and never an unverified one", () => {
    const site = (siteUrl: string, permissionLevel = "SITE_FULL_USER") => ({ siteUrl, permissionLevel });
    expect(pickSpiralSite([site("https://spiralny.com/"), site("sc-domain:spiralny.com")])).toBe("sc-domain:spiralny.com");
    expect(pickSpiralSite([site("http://spiralny.com/"), site("https://spiralny.com/")])).toBe("https://spiralny.com/");
    expect(pickSpiralSite([site("sc-domain:spiralny.com", "SITE_UNVERIFIED_USER"), site("sc-domain:other.com")])).toBeNull();
  });
});
