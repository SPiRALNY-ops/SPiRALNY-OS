/**
 * Findings: the handful of things worth knowing on each page, in plain words. Each is a simple rule
 * over the numbers already on the page, with its threshold named below (and shown behind a "?"),
 * so nothing is a black box. Severity: fix (broken or losing data), watch (moving the wrong way),
 * opportunity (room to grow), good (worth knowing it works).
 */
import { formatFull, formatPercent, pageLabel } from "@/lib/format";
import { OPPORTUNITY_POSITIONS } from "./deep";
import type { AnalyticsView, LongView } from "./types";

export type Severity = "fix" | "watch" | "opportunity" | "good";
export type Area = "leads" | "search" | "website" | "cold";
export type Finding = { id: string; area: Area; severity: Severity; title: string; detail: string; href: string };

export const THRESHOLDS = {
  /** Sign-ups with no known source, above which it's flagged (and at least this many sign-ups). */
  unknownShare: 0.5,
  minSignups: 3,
  /** Share of lead rows on the sheet with no date. */
  undatedShare: 0.2,
  /** A change in clicks or sign-ups vs the period before worth mentioning. */
  bigChange: 0.2,
  /** Recruiting searches almost on page one before it's called out. */
  opportunities: 10,
  /** Recruiting searches split between two or more pages. */
  competing: 5,
  /** A recruiting page losing this share of its clicks (with at least `pageMinClicks` before). */
  pageDrop: 0.3,
  pageMinClicks: 5,
  /** Share of website visits arriving as "Direct". */
  direct: 0.6,
  minVisits: 50,
  /** Bounce rate of cold email. */
  bounceWatch: 0.03,
  bounceFix: 0.05,
  /** A fall in the monthly reply rate, last full month vs the best of the three before. */
  replyDrop: 0.3,
} as const;

const SEVERITY_ORDER: Severity[] = ["fix", "watch", "opportunity", "good"];

/** "in the last 28 days", or "since Nov 20" when Google Analytics started recording inside the period. */
export function websiteWhen(view: AnalyticsView): string {
  const since = view.coverage.ga4;
  if (since && since > view.range.start) {
    return `since ${new Date(`${since}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  }
  return `in the last ${view.range.label.replace(/^Last /, "").toLowerCase()}`;
}
const pct = (n: number) => formatPercent(n, 0);

export function findings(view: AnalyticsView, long: LongView): Finding[] {
  const period = view.range.label.replace(/^Last /, "").toLowerCase();
  const out: Finding[] = [];
  const kpi = (key: string) => view.kpis.find((k) => k.key === key);

  // Leads & sign-ups
  if (view.signupsBySource.origin === "real") {
    const total = view.signupsBySource.buckets.reduce((s, b) => s + b.google + b.referral + b.cold_email + b.unknown, 0);
    const unknown = view.signupsBySource.buckets.reduce((s, b) => s + b.unknown, 0);
    if (total >= THRESHOLDS.minSignups && unknown / total > THRESHOLDS.unknownShare) {
      out.push({
        id: "signups-unknown",
        area: "leads",
        severity: "watch",
        title: `${formatFull(unknown)} of ${formatFull(total)} sign-ups can't be traced to a source`,
        detail: `In the last ${period}. A "How did you hear about us?" question on the sign-up forms, or a note on the SIGNED! tab, would answer it.`,
        href: "/analytics/leads#sources",
      });
    }
    const s = kpi("signups");
    if (s?.previous && s.previous >= THRESHOLDS.minSignups && s.value >= s.previous * (1 + THRESHOLDS.bigChange)) {
      out.push({
        id: "signups-up",
        area: "leads",
        severity: "good",
        title: `Sign-ups are up: ${formatFull(s.value)}, from ${formatFull(s.previous)}`,
        detail: `The last ${period} against the ${period} before.`,
        href: "/analytics/leads",
      });
    }
  }
  if (long.leads) {
    const h = long.leads.health;
    if (h.leadRows && h.noDate / h.leadRows > THRESHOLDS.undatedShare) {
      out.push({
        id: "sheet-undated",
        area: "leads",
        severity: "fix",
        title: `${formatFull(h.noDate)} leads on the sheet have no date`,
        detail: `That's ${pct(h.noDate / h.leadRows)} of the lead rows. Without a date a lead can't be counted in any period; add the inquiry date on the sheet.`,
        href: "/analytics/leads#sheet-health",
      });
    }
    const o = long.leads.onboarding;
    const pending = o.notAssociated;
    if (pending > 0) {
      out.push({
        id: "onboarding-pending",
        area: "leads",
        severity: "watch",
        title: `${formatFull(pending)} ${pending === 1 ? "agent who joined isn't" : "agents who joined aren't"} marked associated`,
        detail: `On the SIGNED! tab, "Check if Associated" isn't ticked${o.withdrew ? ` (agents who withdrew aren't counted)` : ""}.`,
        href: "/analytics/leads#onboarding",
      });
    }
  }

  // Google search
  const deep = view.searches.origin === "real" ? view.searches.deep : null;
  if (deep) {
    const o = deep.opportunities;
    if (o.total >= THRESHOLDS.opportunities) {
      out.push({
        id: "search-opportunities",
        area: "search",
        severity: "opportunity",
        title: `${formatFull(o.total)} recruiting searches are almost on page one`,
        detail: `They showed spiralny.com ${formatFull(o.impressions)} times at positions ${OPPORTUNITY_POSITIONS.from}–${OPPORTUNITY_POSITIONS.to} and got ${formatFull(o.clicks)} clicks. Most clicks go to the top three results.`,
        href: "/analytics/search#opportunities",
      });
    }
    if (deep.competing.recruiting >= THRESHOLDS.competing) {
      out.push({
        id: "search-competing",
        area: "search",
        severity: "watch",
        title: `${formatFull(deep.competing.recruiting)} recruiting searches are split between two or more of your pages`,
        detail: "When two Spiral NY pages answer the same search, Google often ranks both lower. One clear page per topic tends to rank better.",
        href: "/analytics/search#competing",
      });
    }
    const falling = deep.movers?.pages
      .filter((m) => m.group === "recruiting" && m.before >= THRESHOLDS.pageMinClicks && m.now <= m.before * (1 - THRESHOLDS.pageDrop))
      .sort((a, b) => a.now - a.before - (b.now - b.before))[0];
    if (falling) {
      out.push({
        id: "search-page-falling",
        area: "search",
        severity: "watch",
        title: `${pageLabel(falling.label)} lost ${pct(1 - falling.now / falling.before)} of its Google clicks`,
        detail: `${formatFull(falling.now)} clicks in the last ${period}, down from ${formatFull(falling.before)}.`,
        href: `/analytics/search?item=${encodeURIComponent(`page:${falling.key}`)}#movers`,
      });
    }
  }
  const g = kpi("googleClicks");
  if (g?.origin === "real" && g.previous) {
    const change = (g.value - g.previous) / g.previous;
    if (Math.abs(change) >= THRESHOLDS.bigChange) {
      out.push({
        id: "search-clicks-change",
        area: "search",
        severity: change > 0 ? "good" : "watch",
        title: `Google clicks ${change > 0 ? "rose" : "fell"} ${pct(Math.abs(change))}`,
        detail: `${formatFull(g.value)} in the last ${period}, against ${formatFull(g.previous)} the ${period} before.`,
        href: "/analytics/search",
      });
    }
  }

  // Website
  if (view.website.origin === "real" && view.website.sessions >= THRESHOLDS.minVisits) {
    const direct = view.website.sources.find((s) => s.label === "Direct")?.sessions ?? 0;
    if (direct / view.website.sessions >= THRESHOLDS.direct) {
      out.push({
        id: "website-direct",
        area: "website",
        severity: "watch",
        title: `${pct(direct / view.website.sessions)} of website visits arrive as "Direct"`,
        detail: "Typed addresses and bookmarks land here, but so do untagged email links and some robots. Tagging the links in cold emails (UTM) would separate them.",
        href: "/analytics/website#sources",
      });
    }
    const ai = view.website.sources.filter((s) => s.kind === "AI assistant");
    const aiVisits = ai.reduce((s, r) => s + r.sessions, 0);
    if (aiVisits > 0) {
      out.push({
        id: "website-ai",
        area: "website",
        severity: "good",
        title: `AI assistants sent ${formatFull(aiVisits)} ${aiVisits === 1 ? "visit" : "visits"}`,
        detail: `${ai.map((a) => `${a.label} ${formatFull(a.sessions)}`).join(", ")} ${websiteWhen(view)}: people asking an AI about brokerages are being pointed to spiralny.com.`,
        href: "/analytics/website#sources",
      });
    }
  }

  // Cold email
  if (view.coldEmail.origin === "real" && view.coldEmail.health && view.coldEmail.health.sent > 0) {
    const h = view.coldEmail.health;
    const rate = h.bounced / h.sent;
    if (rate >= THRESHOLDS.bounceWatch) {
      out.push({
        id: "cold-bounces",
        area: "cold",
        severity: rate >= THRESHOLDS.bounceFix ? "fix" : "watch",
        title: `${formatPercent(rate, 1)} of cold emails bounced`,
        detail: `${formatFull(h.bounced)} of ${formatFull(h.sent)} in the last ${period}. Above ${pct(THRESHOLDS.bounceWatch)}, inbox providers start trusting the sending addresses less.`,
        href: "/analytics/cold-email#sending",
      });
    }
  }
  if (long.cold) {
    const full = long.cold.months.filter((m) => !m.partial && m.sent > 0);
    const last = full.at(-1);
    const before = full.slice(-4, -1);
    const best = before.sort((a, b) => b.replies / b.sent - a.replies / a.sent)[0];
    if (last && best) {
      const lastRate = last.replies / last.sent;
      const bestRate = best.replies / best.sent;
      if (bestRate > 0 && lastRate <= bestRate * (1 - THRESHOLDS.replyDrop)) {
        out.push({
          id: "cold-reply-drop",
          area: "cold",
          severity: "watch",
          title: `Cold email reply rate fell from ${formatPercent(bestRate, 1)} to ${formatPercent(lastRate, 1)}`,
          detail: `From ${best.label} to ${last.label}, the last complete month: replies for each email sent, all campaigns together.`,
          href: "/analytics/cold-email#trend",
        });
      }
    }
  }

  return out.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

/** The Overview's short list: the most urgent first, at most two per area. */
export function topFindings(all: Finding[], limit = 5): Finding[] {
  const perArea = new Map<Area, number>();
  const out: Finding[] = [];
  for (const f of all) {
    const n = perArea.get(f.area) ?? 0;
    if (n >= 2) continue;
    perArea.set(f.area, n + 1);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}
