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

See `CLAUDE.md` for conventions and project layout.
