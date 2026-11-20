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
- `lib/analytics/` — `build.ts` (assembles the view; real vs sample per source), `queries.ts` (SQL),
  `sample.ts` (deterministic sample), `range.ts` (New York dates, buckets).
- `components/analytics/` — dashboard, charts, tables. `lib/tools.ts` — the 10 tools from the plan.

## Commands
- `npm run dev` — local app (no env needed; embedded database + dev-only session)
- `npm test` — vitest (migrations and analytics run on in-memory PGlite)
- `npm run typecheck`, `npm run build`
- `DATABASE_URL=… npm run db:migrate` — apply migrations to Supabase
- `DATABASE_URL=… npm run grant -- <email> <owner|team|opslabs> ["Name"]` — give a Supabase Auth user access
