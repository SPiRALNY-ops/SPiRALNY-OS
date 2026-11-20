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

1. Supabase: copy the connection string and API keys into Railway (see `.env.example`).
2. Apply the database: `DATABASE_URL=… npm run db:migrate`.
3. Create users in Supabase (Authentication → Users → Add user), then give each a role:
   `DATABASE_URL=… npm run grant -- marcel@spiralny.com owner "Marcel Bellucci"`.
4. Railway builds from `Dockerfile` (tests run first) and checks `/api/health`.
5. Daily sync: add a second Railway service from the same repo, set its **Cron Schedule** to
   `0 11 * * *` (Railway schedules are UTC; this is 6 am in New York in winter, 7 am in summer) and its
   start command to `node scripts/cron-sync.mjs`. It needs `APP_URL` and `CRON_SECRET`, and exits
   once the web service has accepted the request.

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
