# HouseMate

A mobile-first web app for sharing household chores and bills.

- **Design reference:** [`prototype/index.html`](prototype/index.html). Open it in a browser.
- **Plan:** [`docs/implementation-plan.md`](docs/implementation-plan.md). Read it before starting any task.

## Stack

- **Front end:** Vite + React + TypeScript
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
- **Hosting:** Vercel

## Getting started

You need Node.js 20 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values
npm run dev                  # opens on http://localhost:5173
```

Get the values for `.env.local` from the **dev** Supabase project (Project Settings > API).
Only the project URL and the publishable (anon) key go here. Never use the secret key.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the built app locally |
| `npm run lint` | Lint with oxlint |
| `npm run db:push` | Apply new migrations to the linked Supabase project |
| `npm run db:types` | Regenerate `src/types/database.ts` after a schema change |
| `npm run db:seed` | Load fake data into the **dev** project (never prod) |
| `npm run db:test` | Run the isolation and rule checks against the linked project (needs the seed) |

## Database

Migrations live in `supabase/migrations` and are applied with the Supabase CLI
(installed with the project, so use `npx supabase`). One-time setup per computer:

```bash
npx supabase login
npx supabase link --project-ref YOUR_DEV_PROJECT_REF
```

**Security model:** Row Level Security is on for every table. The app can read only its own
household's data and edit only its own profile. Every other write goes through database
functions that check the rules.

**Invite-only signups:** only emails in `public.allowed_signups` can create an account.
To add a tester, run this in the Supabase SQL Editor:

```sql
insert into public.allowed_signups (email) values ('tester@example.com');
```

**Auth settings** are in `supabase/config.toml` (site URL, redirect URLs, password length, the
signup hook). Run `npx supabase config diff` to compare them with the linked project, and
`npx supabase config push` to apply them.

**Password resets:** Supabase's built-in email only reaches your Supabase team until we set up
custom email (Phase 7). Until then, reset a tester's password from the dashboard
(Authentication > Users).

## Folder layout

```
prototype/            original prototype, kept as the design reference
docs/                 implementation plan and decisions
src/
  app/                router, providers, app shell, route guards
  components/         shared UI pieces (Button, Sheet, Avatar...)
  features/           auth, households, invites, bills, chores, calendar, profile
  lib/                supabase client, money, dates, formatting helpers
  styles/             tokens.css, base.css
  types/              database.ts (generated from Supabase)
supabase/
  migrations/         every database change, as numbered SQL files
  functions/          Edge Functions
vercel.json           sends every URL to index.html so links like /join/ABC work
```

## House rules

- Mobile-first CSS. Desktop layouts come in Phase 8.
- Money is stored as integer cents. Dates are real dates.
- Never put secret keys in code, and never commit `.env` files.
- Never use `innerHTML` with user data.
- Every database change is a new file in `supabase/migrations`.
- Work on a branch, open a pull request, and get a review before merging to `main`.

## Deploying

Vercel builds `main` for production and every pull request gets a preview link.
Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel per environment:
dev values for Preview, prod values for Production.
