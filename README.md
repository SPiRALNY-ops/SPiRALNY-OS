# Spiral OS

Spiral NY's operating system, built by OpsLabs. Every lead and agent in one place, from the first form to
Spiral Cloud. The first live tool is **Analytics**; the other nine tools appear in the menu with the plan step
they arrive in.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:3000
```

No setup needed: without `DATABASE_URL` the app uses an embedded Postgres in `.data/pglite`, and without
Supabase keys it uses a local-only developer session. Analytics shows labelled sample data until each source
has synced.

If a page ever keeps reloading itself in development, stop the server, delete `.next` and start it again
(the Turbopack dev cache is switched off in `next.config.ts` for this reason).

## Checks

```bash
npm test           # migrations + analytics on in-memory Postgres
npm run typecheck
npm run build
```

## Deploy (Railway + Supabase)

One Railway service, `web`, in Railway's Virginia region (`iad`), next to the Supabase project
(AWS `us-east-1`), so a database read takes about a millisecond. Deploy from this folder with
`railway up --service web` (the Railway GitHub app isn't installed on the SPiRALNY-ops organisation).

1. Supabase: the **Session pooler** string (Connect → Session pooler) becomes `DATABASE_URL` on Railway;
   the project URL and publishable key become `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (see `.env.example`). Connections to Supabase verify its
   certificate against Supabase's root CA (`lib/db/supabase-ca.ts`).
2. Apply the database: `DATABASE_URL=… npm run db:migrate`.
3. Create users in Supabase (Authentication → Users → Add user), then give each a role:
   `DATABASE_URL=… npm run grant -- marcel@spiralny.com owner "Marcel Bellucci"`.
4. Railway builds from `Dockerfile` (tests run first). The service's settings live on Railway itself,
   because Railway no longer reads `railway.json` (deprecated; ignored for new services): health check
   `/api/health` (120 s timeout), one replica in `iad` (Ashburn, Virginia), restart on failure (5 tries),
   no sleeping. The public domain (https://spiralny-os.up.railway.app) targets port 8080, the `PORT` Railway
   gives the container. Keep it at one replica: the cache, the daily schedule and the one-sync-at-a-time lock
   live in that process. (Railway's replacement, `.railway/railway.ts`, needs the `railway` npm package;
   `railway config pull --variables=unmanaged` writes it from the live settings if you adopt it.)
5. The daily sync is built in, so there's no cron service. Every 10 minutes the server asks itself
   (`POST /api/cron/sync?when=due`) whether the morning sync is due: after 6 am New York time, with no
   sync completed since. A restart or deploy therefore never skips a day. `POST /api/cron/sync` with
   `Authorization: Bearer <CRON_SECRET>` starts one at any time.

## Speed

- **Cached views.** The Analytics view is kept in the server's memory (`"use cache"`), keyed by date
  range, the New York day, and a data version (the newest time in `spiral.sync_runs`). The rendered
  dashboard is cached with the same key. New data or a new day changes the key, so a cached page is
  never out of date.
- **Warm before anyone asks.** After every sync and when the server starts, it builds all four ranges
  (`POST /api/cron/warm`), so visitors don't wait on the database.
- **Parallel reads.** A fresh view runs its ~35 queries in two parallel rounds. Only each page's top five
  searches leave the database, and every search in the period is read once for both the searches
  table and the search groups.
- **Light first screen.** Recharts (about 100 KB compressed) loads after the first screen is interactive
  (`components/analytics/lazy-plots.tsx`); its plots keep their height while loading. Logos are served at
  the size they're shown.

## Connections and the daily sync

An OpsLabs user sees a **Connections** card at the bottom of Analytics, with **Connect Google** and
**Sync now**. Each source fills its own tables, and its Analytics sections switch from sample to real
data after its first successful sync. A connected source with nothing to show yet (no form emails,
no GA4 visits) stays on labelled sample data rather than showing real zeros.

| Source | Needs | What is read |
|---|---|---|
| Form entries | Google connected (Gmail) | WPForms "Spiral OS entry" emails in admin@outreachify.io |
| Instantly | `INSTANTLY_API_KEY` | campaigns, daily numbers (trend lines), Instantly's own totals for each date range (so the page matches Instantly's screens), and a one-time lookup of each form email |
| Search Console | Google connected | 16-month backfill, then the last 5 days each run |
| Google Analytics | Google connected + `GA4_PROPERTY_ID` | sessions by day, landing page, channel and device |

A person counts as **cold email** when Instantly shows them added to a campaign and emailed before
their first form entry. Everyone else stays "Not known yet" until the forms ask how people heard
about Spiral NY.

### WPForms notification (added to forms 23785, 24913, 23741, 25662)

Two notifications per form, both sent to admin@outreachify.io with the same message. The second has
**Enable for abandoned forms entries** switched on.

- Subject `Spiral OS entry: complete`, message starting `Type: complete`
- Subject `Spiral OS entry: abandoned`, message starting `Type: abandoned`

The message for each form is `notificationMessage()` in `lib/sources/wpforms-email.ts` (field IDs read from
the live forms on 2026-11-21: name 1, email 2, phone 3, license 4, total 15, plan 22 on the two commission forms).

See `CLAUDE.md` for conventions and project layout.
