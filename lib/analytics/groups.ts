/**
 * Plain rules that sort Google searches and spiralny.com pages into groups
 * Marcel cares about. Tuned on Spiral NY's real Search Console data
 * (2026-11-23); every rule is shown on the page, so nothing is hidden.
 */

export type SearchGroupKey = "brand" | "recruiting" | "other";
export type PageGroupKey = "recruiting" | "home" | "agents" | "blog" | "other";

export const SEARCH_GROUPS: { key: SearchGroupKey; label: string; rule: string }[] = [
  { key: "brand", label: "Searching for Spiral", rule: "The search names Spiral NY (spiralny, spiral ny, spiral real estate…)." },
  {
    key: "recruiting",
    label: "Brokerage, commission & license",
    rule: "Searches an agent makes when choosing a brokerage: commission, splits, brokerage, parking or hanging a license, referral agent, joining.",
  },
  { key: "other", label: "Everything else", rule: "Home buyers, agents' names, market news and other searches." },
];

export const PAGE_GROUPS: { key: PageGroupKey; label: string; rule: string }[] = [
  {
    key: "recruiting",
    label: "Recruiting pages",
    rule: "Pages and blog posts about commission plans, parking a license, referral agents and joining.",
  },
  { key: "home", label: "Home page", rule: "spiralny.com itself." },
  { key: "agents", label: "Agent profiles", rule: "Pages under /our-agents/." },
  { key: "blog", label: "Other blog posts", rule: "Other posts on blog.spiralny.com (market reports, buying guides)." },
  { key: "other", label: "Other pages", rule: "Listings, buyer's agent page, resources and the rest." },
];

const BRAND = /\bspiral ?ny\b|\bspiralny|\bspiral (nyc|new york|real estate|realty|agency|company|properties|rentals?|cloud)\b|^(the )?spiral$/i;
// "Spiralny" is also Polish for "spiral" (spiral wire, hoses, notebooks…): Polish letters, Polish words,
// or a single word followed by "spiralny" ("drut spiralny") are not Spiral NY. Also other spirals.
const NOT_BRAND =
  /przew|peszel|pneumat|kabel|kablow|adapter|aplikator|drut|zwi[aą]zek|staircase|stair\b|notebook|[ąćęłńśźż]|^(?!the\b|www\b)[^\s"]+ spiralny$/i;
const RECRUITING =
  /commission|split|brokerage|\bbrokers?\b|licen[cs]e.*\b(park|hang|hold|keep|active|inactive)|\b(park|parking|hang|hold)\b.*licen[cs]e|referral (agent|only|license|company)|real estate referral|\bjoin|career|hiring|sponsor|desk fee|\b(100|90) ?%|\b100 percent/i;

export function searchGroup(query: string): SearchGroupKey {
  if (BRAND.test(query) && !NOT_BRAND.test(query)) return "brand";
  if (RECRUITING.test(query)) return "recruiting";
  return "other";
}

const RECRUITING_PAGE = /commission|brokerage|split|park-your-license|park-my-license|referral-agent|join-our-team|join-spiral|careers?|hang-your-license/i;

export function pageGroup(url: string): PageGroupKey {
  let host = "spiralny.com";
  let path = url;
  try {
    const u = new URL(url, "https://spiralny.com");
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname;
  } catch {
    // keep the raw value
  }
  if (RECRUITING_PAGE.test(path)) return "recruiting";
  if (host.startsWith("blog.")) return "blog";
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/our-agents")) return "agents";
  return "other";
}
