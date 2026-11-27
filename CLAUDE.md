# Spiral OS

Spiral OS is the operating system OpsLabs is building for **Spiral NY** (owner: Marcel Bellucci), following the
"Spiral OS Plan of Action" (19 Nov 2026): 10 tools, 20 integrations, one record per person. Build order: Step 1
See everything → Step 2 Onboarding → Step 3 AI calls → Step 4 Georgia and documents. The first live tool is
**Analytics**.

@AGENTS.md

## Ground rules
- **Built from scratch.** Do not look into, copy from, or borrow patterns from other client projects in
  `~/Desktop/Code`. References: the plan PDF, spiralny.com, OpsLabs' opslabs-stats site, official docs.
- **Brand only from spiralny.com**: SPiRALNY lion logo and icon (`public/brand/`), Work Sans, orange `#f26033`,
  charcoal `#252526`. Buttons are charcoal (white on orange is only ~3.2:1); orange is the accent.
- **Client-facing instructions** (access requests, setup steps) must come from official help pages, never memory.
- **Sample data is always labelled.** A source with no successful sync shows sample numbers with a "Sample data"
  badge. Never mix real and sample numbers in one section.
- **Charts follow the dataviz skill**: categorical colours in fixed order (validated; see `app/globals.css`),
  no dual axes, legend for ≥2 series, every chart has a table view, text never wears the series colour.

## Design (Analytics sets the pattern)
- spiralny.com's own vernacular: charcoal `#252526` bar with the logo (our sidebar / phone header), bold
  Work Sans headings with the thick orange rule (`.brand-underline`), pill buttons, `#f4f4f4` canvas,
  `#666666` secondary text. Colours were counted from the site's stylesheet; don't invent new brand colours.
- One bold moment per page: the charcoal hero band (one hero figure ≥48px + a tall segmented bar).
  Everything else is quiet: one number strip with hairline dividers and sparklines, then chapters headed
  with the orange rule. Avoid identical card grids, ALL-CAPS labels and `A · B` meta strings.
- Lead-source stacking order is google → referral → cold_email → unknown (validated: aqua beside grey
  fails colour-blind separation). Inside the charcoal band, series use their dark-surface steps (`.hero-band`).
- Big numbers use proportional figures; `.tabular` only for aligned columns.
- Phones are first-class: no table ever scrolls sideways on a phone. Below `sm` every table is a list (name and
  note left, the figure the list is sorted by on the right, the other figures in one plain line under it, a
  `SortSelect` instead of column headers); Pages and Campaigns stay lists until `xl`, where all columns fit.
  KPI and `Stat` figures become rows on phones (`STAT_GRID`); four/five columns only from `xl`. The "?" is a
  popover (`InfoTip`: tap on phones, hover with a mouse); `TipLabel` keeps it on the label's last line.
  Sideways-scrolling rows (chips, chapter links) fade at the hidden edge (`useEdgeFade`). Check 360, 390, 768,
  1024, 1280 and 1440 wide for sideways overflow before shipping.
- Accessibility (Lighthouse/axe 100 in light and dark): text ≥4.5:1, so never fade muted text with `opacity`;
  tap targets ≥24px (`InfoTip` is 24px drawn as 16px). The only accepted Lighthouse failure is SEO
  "blocked from indexing" (every page is `noindex`; `app/robots.ts` keeps pages crawlable so crawlers see it).
- Every section says its finding in one plain sentence (computed), explains terms behind a "?" (`InfoTip`),
  and states its source and caveats in the footer. One-hue ranked bars use `--chart-slate` (site slate).
- Honesty rules: no comparison when a source has no data for the whole previous period ("No earlier data");
  days a source hasn't reported or recorded are gaps, never zeros; partial first/last months are labelled;
  rates use a denominator that means what it says (Instantly's "contacted" is a daily sum, so rates use
  emails sent; "new people emailed" is the unique count). Columns with no data yet are hidden, with a note.
  A source that starts recording inside the period says "Counted since <day>" (`Kpi.since`). Finding
  sentences name ties as shown (0.5% and 0.5% are a tie), and a "best rate" needs ≥100 emails sent behind it.
- Attribution: "lead_sheet" and "unknown" are both "not known yet"; Instantly re-labels either as cold email
  when the person was in a campaign and emailed before they first appeared. Campaign columns count only
  cold-email people, so they never exceed the funnel.
- Client hand-outs (user guide PDF, logins) live in gitignored `deliverables/`; the repo is public.

## Stack
Next.js 16 (App Router, `cacheComponents` on) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Radix) ·
recharts · zod · Supabase (Postgres + Auth) · vitest · Railway (Dockerfile; service settings live on Railway).

This Next.js version differs from older ones — read `node_modules/next/dist/docs/` before writing Next code.
With Cache Components: anything that reads cookies, search params or the database must sit inside `<Suspense>`;
`dynamicParams` and `runtime` segment configs are not allowed; middleware is `proxy.ts`.

## Layout
- `app/(os)/` — the signed-in shell (sidebar with all 10 tools) and pages. `app/(os)/[tool]` = coming-soon tools.
- Analytics (v3) is an Overview plus four deep pages: `app/(os)/analytics/{page,leads,search,website,cold-email}`.
  `layout.tsx` is static (title only); `analytics-route.tsx` does access (`lib/analytics/access.ts`, on every page
  and in `/api/analytics/item`), the cached render per page+range+day+version, and mounts `DetailPanel`.
  `RangeFrame` is the one sticky row: page tabs (period kept in `?range`) and the period picker; old `#search`-style
  hashes redirect to their tab. Detail panels open with `openItem()` (history.pushState `?item=page:/x/` or
  `search:…`; Back closes) and load from `/api/analytics/item` (zod-checked, 401 not redirect, `cachedItem`).
- `app/sign-in/` — Supabase email + password sign-in. `proxy.ts` refreshes the session (`getClaims`).
- `lib/auth/session.ts` — `getSession` / `requireUser` / `canSee` (roles: owner, team, opslabs).
- `lib/db/` — Postgres (`DATABASE_URL`) or embedded PGlite locally; `runMigrations`.
- `supabase/migrations/` — numbered, re-runnable SQL. All tables in schema `spiral`, RLS on, no grants to
  anon/authenticated. Apply to Supabase with `npm run db:migrate`.
- `lib/analytics/` — `build.ts` (the period view; real vs sample per source), `deep.ts` (period: almost-page-one,
  movers, competing pages without sitelinks, click rate by position, questions, website sources by site),
  `long.ts` (range-independent: 16-month search, sign-ups by month/plan, inquiry-month outcomes, backlog,
  onboarding, sheet health, reply rate by week/month), `items.ts` (detail panels), `insights.ts` (findings:
  named thresholds, fix/watch/opportunity/good, `topFindings` for the Overview), `queries.ts` (core SQL),
  `details.ts` (plans, lead status, search/page groups, website, cold email funnel and steps, coverage),
  `groups.ts` (plain rules for search and page groups, shown on the page), `sample.ts`, `range.ts`.
- `components/analytics/` — `dashboard.tsx` (the five page layouts), findings, detail panel, trend cards
  (StackCard / MonthlyBarsCard / ReplyRateCard, all with a table view), deep sections, charts, tables, OpsLabs-only
  connections panel (stays on the Overview). New sections show "Shows once X is connected", never sample numbers.
  `lib/tools.ts` — the 10 tools.
- `lib/sources/` — one API client per source (plain `fetch`, injected for tests): Google OAuth (PKCE),
  GA4 Data API, Search Console, Gmail, Instantly v2, and the WPForms notification parser. Every endpoint
  and field name comes from the official spec (Google discovery docs, Instantly OpenAPI); cite it in the file.
- `lib/sync/` — `runSync` holds a database lease (`lease.ts`, `spiral.sync_state`, heartbeat per step; also
  progress markers) and runs forms → lead sheet → instantly → gsc → ga4, logging each in `spiral.sync_runs`.
  `dueSources()` catches up per source (a run cut short by a deploy re-runs only what's missing). A step
  returns "skipped" (sample data stays) when connected but empty. `server.ts` = env config, one-at-a-time
  lock, `after()`, `syncDue()`. Triggered by `/api/cron/sync` (Bearer `CRON_SECRET`), "Sync now", and Google
  connect. `scheduler.ts` (started by `instrumentation.ts` in production) asks `/api/cron/sync?when=due`
  every 10 minutes (once a day after 6 am New York) and warms the cache on start; `self.ts` calls the
  server's own `/api/cron/*` routes, because cached work must run inside a request.
- Speed: `lib/analytics/index.ts` caches views with `"use cache"`, keyed by range + New York day + data
  version (newest *finished* `sync_runs` time; running steps never clear the cache): `cachedView` per range,
  `cachedLong` once a day, `cachedItem` per panel. Each page caches its rendered output with the same key, and
  `/api/cron/warm` builds 28 days first, then the other ranges and the long view, after each sync (it reports
  heap/RSS; `cacheMaxMemorySize` is 256 MB in next.config.ts). Keep queries parallel (`Promise.all`) and Recharts
  behind `components/analytics/lazy-plots.tsx`. Production: one Railway replica in `iad` (Virginia) beside
  Supabase `us-east-1` (settings live on Railway; `railway.json` is no longer read); `DATABASE_URL` is the session pooler, TLS verified with `lib/db/supabase-ca.ts`.
- `lib/people.ts` — one record per person: form entries upsert by email, else phone; never blank out data.

## Commands
- `npm run dev` — local app (no env needed; embedded database + dev-only session)
- `npm test` — vitest (migrations, analytics and the full sync run on in-memory PGlite with API fixtures)
- `npm run typecheck`, `npm run build`
- `DATABASE_URL=… npm run db:migrate` — apply migrations to Supabase
- `DATABASE_URL=… npm run grant -- <email> <owner|team|opslabs> ["Name"]` — give a Supabase Auth user access
