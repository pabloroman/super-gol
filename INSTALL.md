# Installation & operations

Everything needed to run Super Gol locally and to deploy it. For what the game is
and how it's built, see [README.md](README.md); for the conventions that govern
changes to it, [CLAUDE.md](CLAUDE.md).

- [Local development](#local-development)
- [Dev accounts](#dev-accounts)
- [Resetting the database](#resetting-the-database)
- [Working against a hosted project](#working-against-a-hosted-project)
- [Deploying the frontend (Vercel)](#deploying-the-frontend-vercel)
- [Deploying migrations & the resolver](#deploying-migrations--the-resolver)

## Local development

Needs [Docker](https://docs.docker.com/desktop/) (or Rancher/Podman/OrbStack)
running, and Node. The Supabase CLI is a devDependency, so it always takes the
`npx` prefix — a globally installed CLI may be a different version than the repo
pins.

**1. Backend.** Applies every migration and then `seed.sql`, and prints the URLs
and keys:

```bash
npm install
npx supabase start
```

**2. Env.** Point the app at the local stack with `.env.local` (gitignored; Vite
loads it ahead of `.env`, so remote credentials in `.env` stay intact — delete it
to switch back):

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable key from the start output>
```

**3. Frontend**, in a second terminal:

```bash
npm run dev
```

Both are long-running processes and **both must be up**: `npx supabase start`
serves no app, and `npm run dev` has no backend without it. A dev server that was
never started looks exactly like a broken app — `localhost:5173` simply refuses
the connection.

| | |
|---|---|
| App | http://localhost:5173 |
| Studio | http://localhost:54323 |
| API | http://127.0.0.1:54321 |
| Mail catcher | http://localhost:54324 |

| Command | |
|---|---|
| `npx supabase status` | reprint URLs & keys |
| `npx supabase stop` | stop the stack |
| `npm run db:reset` | re-apply migrations + seed (wipes local data — see below) |
| `npm run typecheck` | `tsc -b --noEmit`, tests included |
| `npm run test` | Vitest run |

`config.toml`'s `db.major_version` **must match the remote** (`SHOW
server_version;` there) — local otherwise tests a different Postgres than
production.

## Dev accounts

`supabase/seed.sql` creates two accounts on every reset. They are local-only, and
their passwords are published here and in the seed file itself, which is the whole
point: nothing about them is a secret.

| email | password | |
|---|---|---|
| `admin@supergol.test` | `password123` | `is_admin` — the Admin tab is visible |
| `coach@supergol.test` | `password123` | a plain player, the default experience |

Both start with what any new account gets: **500 coins**, the **55-card starter
deck** (the *juego básico*, flagged `is_starter`), and their `starter_grant` row
in the `transactions` ledger. Their UUIDs are fixed (`…0001` and `…0002`), so
anything you reference by hand — a squad you keep rebuilding, a match you're
debugging — survives a reset.

You can still sign up in-app instead; `enable_confirmations = false` locally, so
sign-up logs you straight in and the mail catcher above holds anything sent.

### Why the accounts are seeded at all

A reset drops `auth.users`, so every reset otherwise starts with no way into the
app. The admin account is the sharper problem: `profiles.is_admin` defaults to
`false` (`0006_admin_cards.sql`) and nothing sets it on signup, while the only
in-app way to set it — `admin_set_admin` (`0011_admin_users.sql`) — already
requires you to be an admin. That's a cycle you can only break from outside the
app, so without a seeded admin every reset means signing up by hand and then
flipping the flag in SQL before the Admin screen will open.

Once one admin exists the cycle is broken, and the **Usuarios** tab can promote
anyone else. Reaching for SQL directly is only ever necessary if you delete the
seeded admin:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

### How the seed builds them

It inserts into `auth.users` and lets the existing `on_auth_user_created` trigger
do the rest, rather than writing the profile, coins, and starter cards itself. So
the seeded accounts are built by **the same code path as a live signup**
(`handle_new_user`, `0003` + `0012`) and can't drift from it: change the trigger
and these accounts change with it. The coach name goes into `raw_user_meta_data`,
exactly where the signup form puts it.

Two details there are invisible until they bite, and both are commented in the
seed file:

- **`auth.identities` is required for password login.** A user row on its own
  exists but cannot authenticate, because GoTrue looks the user up by provider
  identity. Its `email` column is generated from `identity_data` — never insert
  into it.
- **The token columns get `''`, not `NULL`.** The schema permits `NULL`, but
  GoTrue scans them into a non-nullable Go string and errors on it.

### The guard

`npm run db:reset:linked` passes `--no-seed`, so the seed does not run on the remote
at all. But a bare `supabase db reset --linked` (or any attempt to seed a hosted DB)
would run the seed, where a published password on an `is_admin` account would be a
real breach. The seed guards against that itself and refuses to run anywhere but the
local stack:

```
ERROR:  seed.sql refused to run: this database is not the local Supabase stack
```

It tests the local stack's JWT secret, which is hardcoded in the CLI and published
in its docs; every hosted project generates its own, so the value cannot match a
real database. That makes the check ask the question that actually matters — *are
the credentials here already public?* — rather than proxying for it. It fails
safe: a database that doesn't expose the setting at all also refuses. So if a
future CLI renames or drops that setting, local resets start failing with the
message above rather than silently seeding.

## Resetting the database

`npm run db:reset` re-applies every migration and then the seed. It **wipes all
local data, accounts included** — the two dev accounts come back, anything you
created by hand does not.

**Always apply migrations with the CLI** (`npm run db:reset` locally, `npm run
db:push` against a project), never by pasting SQL into the Studio editor. Applied
files are tracked in `supabase_migrations.schema_migrations`; a hand-applied
schema leaves that ledger empty and the GitHub integration can no longer reconcile
what's applied, after which new migrations silently fail to apply.

The ledger keys on the **version prefix**, not the filename — renaming an
already-applied `0012_foo.sql` to `0012_bar.sql` makes the CLI report `applied: []`
and skip it. Locally, `db:reset` is the way out. New migrations must carry a
version above the highest already recorded.

## Working against a hosted project

```bash
npx supabase link --project-ref <ref>
npm run db:push
```

`npm run db:reset:linked` also exists and resets the **linked remote**, wiping its
data and re-applying migrations from scratch. It sits one word away from `npm run
db:reset` in `package.json`, and it will happily drop the database it's pointed at —
so it's for a database you mean to recreate (see the catalog runbook below).

It passes `--no-seed`: the two seed files (`seed_cards.sql`, `seed.sql`) both guard
against a hosted DB and would otherwise **abort the reset at the seed step** with
`seed_cards.sql refused to run: this database is not the local Supabase stack`.
Skipping the seed is also correct — a hosted catalog comes from the admin CSV import,
not the seed. (The reset applies + records migrations before seeding, so even without
`--no-seed` the guard only stops the seed, not the migrations; `--no-seed` just makes
it exit clean.)

## Deploying the frontend (Vercel)

The app is a static Vite SPA, so any static host works; Vercel is the smoothest.

1. **Import the repo** in Vercel. The framework preset auto-detects as *Vite* —
   `vercel.json` pins the build command (`npm run build`) and output dir (`dist`),
   so no manual configuration is needed.
2. **Add the environment variables** (Project → Settings → Environment Variables),
   the same two from `.env.example`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

   These are baked in at build time (they're `VITE_`-prefixed), so a redeploy is
   needed after changing them. Leave `VITE_LOCAL_ENGINE` unset in production — the
   authoritative `play-match` Edge Function must own coin payouts.
3. **Deploy.** `vercel.json` rewrites all non-asset routes to `index.html`, so
   client-side routes (`/play`, `/squad`, `/collection`, `/store`) survive a hard
   refresh and deep link instead of 404-ing.

Because the anon key is server-guarded by RLS and the economy runs through
`SECURITY DEFINER` functions, shipping it to the browser is expected and safe.

### Email confirmation & auth redirects

Sign-up sends a confirmation email; the link must land back on the deployed app.
Two settings live outside the repo and, if wrong, produce a link that bounces to
`vercel.com/login` (a Vercel login wall) or reports `otp_expired`:

1. **Vercel Deployment Protection.** The generated `*-<team>.vercel.app` preview
   domains have **Vercel Authentication** on by default, so any request — including
   the Supabase redirect — is intercepted and sent to `vercel.com/login?next=…`.
   Turn it off for Production (Project → Settings → Deployment Protection), or use
   a **public custom domain**, so the redirect reaches the app instead of a login
   wall.
2. **Supabase URL configuration** (Authentication → URL Configuration). Set **Site
   URL** and add **Redirect URLs** to the *public* production origin — never a
   protection-gated preview domain. The client also passes `emailRedirectTo`
   (`${window.location.origin}/`) on sign-up and resend, so confirmation returns to
   whatever origin the user signed up from; that origin must be in the allow-list.

`otp_expired` on the *first* click usually means an email link-scanner prefetched
the single-use `{{ .ConfirmationURL }}` and burned the token. Mitigate by raising
the OTP expiry (Authentication → Email) and/or switching the email template to the
`token_hash` confirm flow. The login screen also detects the `otp_expired` /
`access_denied` hash Supabase appends and offers a **one-click resend**.

## Deploying migrations & the resolver

Deployment is automatic through the **Supabase GitHub integration** (branching):
merging to `main` applies any new `supabase/migrations/**` **and** deploys the
`play-match` Edge Function (declared in `config.toml` as `[functions.play-match]`).
There is no bespoke deploy workflow to maintain.

- **Migrations** are tracked per database in
  `supabase_migrations.schema_migrations`; the integration applies only files whose
  version isn't already recorded there. This is the same ledger described under
  [Resetting the database](#resetting-the-database), and the same reason to never
  paste SQL by hand. If a project was ever set up that way, bootstrap the ledger
  once by recording the already-applied versions.
- **Turn on the required check.** In the Supabase integration settings enable the
  migration status check and make it a **required check** on `main` (GitHub →
  Settings → Branches), so a PR with a failing migration can't merge green and
  silently no-op on production.
- **`seed.sql` never runs here.** The integration applies migrations only, and both
  seed files (`seed_cards.sql`, `seed.sql`) carry a guard that refuses a hosted
  database anyway.

### Bootstrapping the card catalog

The 518-card LaLiga catalog is **not** a migration — it's a dynamic, admin-owned
table (admins edit cards in-app), so seeding it through the ledger would fight those
edits and bloat history. It lives in two places instead:

- **Local dev** — `supabase/seed_cards.sql`, generated by `npm run build:cards` and
  run *before* `seed.sql` on `db:reset` / `start`. It carries a local-only guard, so
  it never reaches a hosted DB.
- **Production / any hosted DB** — imported through the app. Migrations arrive via
  the GitHub integration (or `npm run db:push`); to rebuild a hosted DB from scratch
  use `npm run db:reset:linked` (wipes it, re-applies migrations, skips the seed).
  Either way the `cards` table comes up **empty** by design. To fill it:
  1. Sign up an account, then set `is_admin = true` on its `profiles` row once (via
     Studio) so the Admin tab appears.
  2. Admin → **Cartas** → **import `scripts/cards/data/laliga-2025-cards.csv`**
     (regenerate with `npm run export:cards:csv`). This upserts all 518 cards and,
     via the CSV's `is_starter` column, flags the 55-card starter deck — so new
     signups receive their deck and `open_pack` works.

Thereafter the DB is the source of truth. A later catalog-refresh import never resets
the starter deck unless its CSV carries the `is_starter` column (`admin_upsert_cards`
applies `is_starter` only for rows that provide it).

The Edge Function is committed **self-contained**
(`supabase/functions/play-match/index.ts` has the engine bundled in). To change the
resolver, edit `supabase/functions/_src/play-match.ts` and run
`npm run build:function`, then commit the regenerated `index.ts` — the integration
deploys the committed file, and it must never be hand-edited. Locally, `npx
supabase start` serves the **generated** `index.ts`, so rerun `npm run
build:function` after any `src/game/engine/` change or the local function stays
stale.
