/**
 * Spiral NY's lead sheet ("Agents Leads", kept by support@spiralny.com).
 * Tabs read, as laid out on 2026-11-23:
 *   SIGNED!       agents who joined: Date Joined, name, phone, email, Status (= plan)
 *   FWD/FRESH     incoming leads: Date, name, phone, email, Status, Inquiring about?, How did you find us?
 *   Instantly     people who replied to cold email: Date of Inquiry, ..., Inquiring about?
 *   SEO           leads from search: Date, name, Where did you find us
 *   Cold-calling  leads from calls (empty today)
 * Prospect lists (BROKER LEADS, School leads, ...) are people Spiral NY reaches
 * out to, not people who came in, so they are not read.
 * Columns are found by their header text, so moving a column doesn't break it.
 */
import type { LeadSource } from "@/lib/analytics/types";
import { normalizePhone } from "./wpforms-email";

type TabRule = { name: string; kind: "lead" | "signup"; source?: LeadSource };

export const LEAD_SHEET_TABS: TabRule[] = [
  { name: "signed!", kind: "signup" },
  { name: "fwd/fresh", kind: "lead" },
  { name: "instantly", kind: "lead", source: "cold_email" },
  { name: "seo", kind: "lead", source: "google" },
  { name: "cold-calling", kind: "lead" },
];

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function tabRule(title: string): TabRule | undefined {
  return LEAD_SHEET_TABS.find((r) => r.name === norm(title));
}

export type LeadSheetRow = {
  tab: string;
  rowNumber: number; // 1-based, as in the sheet
  kind: "lead" | "signup";
  day: string | null; // YYYY-MM-DD
  fullName: string | null;
  email: string | null;
  phone: string | null;
  licenseNumber: string | null;
  status: string | null;
  plan: "100%" | "90%" | "Referral" | "Park Your License" | null;
  howFound: string | null;
  source: LeadSource;
};

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const iso = (y: number, m: number, d: number) =>
  y > 1990 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;

/** Sheets serial number (days since 1899-12-30), "July 30, 2026", "7/28/2026" or "2026-07-28". */
export function parseSheetDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 20000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86_400_000);
    return d.toISOString().slice(0, 10);
  }
  const s = norm(value);
  if (!s) return null;
  let m = s.match(/^([a-z]+)\.? (\d{1,2}),? (\d{4})$/);
  if (m) {
    const month = MONTHS.findIndex((name) => name.startsWith(m![1].slice(0, 3)));
    return month >= 0 ? iso(Number(m[3]), month + 1, Number(m[2])) : null;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return iso(Number(m[3]), Number(m[1]), Number(m[2]));
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return iso(Number(m[1]), Number(m[2]), Number(m[3]));
  return null;
}

export function normalizePlan(value: unknown): LeadSheetRow["plan"] {
  // A cell formatted as a percentage arrives unformatted as a fraction: 90% -> 0.9, 100% -> 1.
  const n = typeof value === "number" ? value : /^\d*\.?\d+$/.test(String(value ?? "").trim()) ? Number(value) : NaN;
  if (n === 1) return "100%";
  if (n === 0.9) return "90%";
  const s = norm(value);
  if (s.includes("100")) return "100%";
  if (s.includes("90")) return "90%";
  if (s.includes("referral")) return "Referral";
  if (s.includes("park")) return "Park Your License";
  return null;
}

/** Only for a column that asks "How/Where did you find us?" on its own (not mixed with notes). */
export function sourceFromHowFound(value: unknown): LeadSource | null {
  const s = norm(value);
  if (!s) return null;
  if (/google|seo|search/.test(s)) return "google";
  if (/referr|friend|recommend|word of mouth/.test(s)) return "referral";
  if (/cold email|instantly|your email|an email/.test(s)) return "cold_email";
  return null;
}

const EMAIL_RE = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const text = (v: unknown) => {
  const s = String(v ?? "").replace(/[‪-‮]/g, "").trim();
  return s && s !== "-" && s !== "--" ? s : null;
};

export function parseLeadSheetTab(title: string, values: unknown[][]): LeadSheetRow[] {
  const rule = tabRule(title);
  if (!rule || values.length < 2) return [];
  const headers = values[0].map(norm);
  const col = (test: (h: string) => boolean) => headers.findIndex(test);
  const c = {
    date: col((h) => h.startsWith("date")),
    first: col((h) => h === "first name"),
    last: col((h) => h === "last name"),
    name: col((h) => h === "name"),
    phone: col((h) => h.includes("phone")),
    email: col((h) => h === "email"), // the first "Email" column; later ones are outreach checkboxes
    status: col((h) => h === "status"),
    inquiring: col((h) => h.startsWith("inquiring about")),
    howFound: col((h) => /(how|where) did you find us/.test(h) && !h.includes("notes")),
    license: col((h) => h.startsWith("license")),
  };
  const at = (row: unknown[], i: number) => (i >= 0 ? row[i] : undefined);

  const rows: LeadSheetRow[] = [];
  values.slice(1).forEach((row, i) => {
    const fullName =
      [text(at(row, c.first)), text(at(row, c.last))].filter(Boolean).join(" ") || text(at(row, c.name)) || null;
    const email = text(at(row, c.email))?.match(EMAIL_RE)?.[0].toLowerCase() ?? null;
    const phone = normalizePhone(text(at(row, c.phone)));
    if (!fullName && !email && !phone) return; // an empty row
    const status = text(at(row, c.status));
    const howFound = text(at(row, c.howFound));
    rows.push({
      tab: title,
      rowNumber: i + 2,
      kind: rule.kind,
      day: parseSheetDate(at(row, c.date)),
      fullName,
      email,
      phone,
      licenseNumber: text(at(row, c.license)),
      status,
      // On SIGNED! the Status column is the plan they joined; elsewhere "Inquiring about?" is.
      plan: normalizePlan(c.inquiring >= 0 ? at(row, c.inquiring) : rule.kind === "signup" ? status : null),
      howFound,
      source: rule.source ?? sourceFromHowFound(howFound) ?? "unknown",
    });
  });
  return rows;
}
