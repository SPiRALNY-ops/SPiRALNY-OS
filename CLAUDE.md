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
- Every section says its finding in one plain sentence (computed), explains terms behind a "?" (`InfoTip`),
  and states its source and caveats in the footer. One-hue ranked bars use `--chart-slate` (site slate).
- Honesty rules: no comparison when a source has no data for the whole previous period ("No earlier data");
  days a source hasn't reported or recorded are gaps, never zeros; partial first/last months are labelled;
  rates use a denominator that means what it says (Instantly's "contacted" is a daily sum, so rates use
  emails sent; "new people emailed" is the unique count). Columns with no data yet are hidden, with a note.

## Stack
Next.js 16 (App Router, `cacheComponents` on) · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Radix) ·
recharts · zod · Supabase (Postgres + Auth) · vitest · Railway (Dockerfile + railway.json).

This Next.js version differs from older ones — read `node_modules/next/dist/docs/` before writing Next code.
With Cache Components: anything that reads cookies, search params or the database must sit inside `<Suspense>`;
`dynamicParams` and `runtime` segment configs are not allowed; middleware is `proxy.ts`.

## Layout
- `app/(os)/` — the signed-in shell (sidebar with all 10 tools) and pages. `app/(os)/[tool]` = coming-soon tools.
- `app/sign-in/` — Supabase email + password sign-in. `proxy.ts` refreshes the session (`getClaims`).
- `lib/auth/session.ts` — `getSession` / `requireUser` / `canSee` (roles: owner, team, opslabs).
- `lib/db/` — Postgres (`DATABASE_URL`) or embedded PGlite locally; `runMigrations`.
- `supabase/migrations/` — numbered, re-runnable SQL. All tables in schema `spiral`, RLS on, no grants to
  anon/authenticated. Apply to Supabase with `npm run db:migrate`.
- `lib/analytics/` — `build.ts` (assembles the view; real vs sample per source), `queries.ts` (core SQL),
  `details.ts` (plans, lead status, search/page groups, website, cold email funnel and steps, coverage),
  `groups.ts` (plain rules for search and page groups, shown on the page), `sample.ts`, `range.ts`.
- `components/analytics/` — dashboard, charts, tables, OpsLabs-only connections panel. `lib/tools.ts` — the 10 tools.
- `lib/sources/` — one API client per source (plain `fetch`, injected for tests): Google OAuth (PKCE),
  GA4 Data API, Search Console, Gmail, Instantly v2, and the WPForms notification parser. Every endpoint
  and field name comes from the official spec (Google discovery docs, Instantly OpenAPI); cite it in the file.
- `lib/sync/` — `runSync` runs forms → instantly → gsc → ga4, logging each in `spiral.sync_runs`. A step
  returns "skipped" (sample data stays) when connected but empty. `server.ts` = env config, one-at-a-time
  lock, `after()`. Triggered by `/api/cron/sync` (Bearer `CRON_SECRET`), "Sync now", and Google connect.
- `lib/people.ts` — one record per person: form entries upsert by email, else phone; never blank out data.

## Commands
- `npm run dev` — local app (no env needed; embedded database + dev-only session)
- `npm test` — vitest (migrations, analytics and the full sync run on in-memory PGlite with API fixtures)
- `npm run typecheck`, `npm run build`
- `DATABASE_URL=… npm run db:migrate` — apply migrations to Supabase
- `DATABASE_URL=… npm run grant -- <email> <owner|team|opslabs> ["Name"]` — give a Supabase Auth user access
