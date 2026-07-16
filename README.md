# Super Gol

A mobile-first, web-based digital recreation of **Super Gol** — the football
card game published by the Spanish sports daily *Marca* in the late 1990s.

Collect cards → build a squad → compete → earn coins → open packs → build a
better squad. The classic collectible live-service loop, on top of the original
game's cards and rules.

## The game loop

```
 Collect ──► Build ──► Compete ──► Earn ──► Open packs ──┐
    ▲          (11+5, ≤100 pts)   (vs AI)   (coins)      │
    └───────────────────────────────────────────────────┘
```

- **Cards** carry biographical data, a **point cost**, ten ability ratings
  (RB, A, RC, D, RG, V, PC, PL, PA, DL) and a **pitch-zone grid**.
- **Squads** are 11 starters + up to 5 on the bench, capped at **100 points**.
- **Matches** are resolved server-side and award coins.
- **Packs** (common / frecuente / rara odds) are bought with coins.

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Vite + React 19 + TypeScript, Tailwind, installable PWA (mobile-first) |
| Backend | **Supabase** — Postgres, Auth, Row Level Security |
| Game logic | Postgres RPCs (`SECURITY DEFINER`) + a Deno Edge Function — server-authoritative economy & results |

### Why server-authoritative?

Currency, pack pulls and match results **cannot be trusted to the client** or a
player could grant themselves coins and perfect cards. Row Level Security lets
clients *read* only their own rows; every sensitive write goes through a
Postgres function that the client can call but not forge:

- `open_pack(pack_id)` — charge coins, roll cards by rarity weights, grant them.
- `save_squad(...)` — validate ownership, 11+5 counts, and the 100-point cap.
- `record_match(...)` — commit a resolved match (award coins, record history).
  Locked to `service_role`; only the `play-match` Edge Function may call it.

## The match engine is authoritative

The **real basic-game rules** live as a concrete engine in `src/game/engine/`: a
pure, dependency-free, seeded, deterministic TypeScript module implementing the
*Juego Básico* — the `d6 + ability + marcaje` contest (TABLA 1 & TABLA 2), keeper
saves, and the win-by-two-goals ending — faithful to `docs/rulebook/`. It uses a
zone-abstracted board (an advancement band behind a `Pitch` interface) so a full
6×5 board can drop in later. Unit tests live in `src/game/engine/__tests__/`
(`npm run test`).

That **same module** is the authoritative resolver: the `play-match` **Supabase
Edge Function** bundles it in (`npm run build:function` inlines the engine into the
self-contained `supabase/functions/play-match/index.ts`), runs the match
server-side, and commits the result through the `service_role`-only `record_match`
function — so the browser
can trigger a match but can't forge the result or the coins. The client calls it
through `serverMatchEngine` behind the `MatchEngine` interface
(`src/game/engine.ts`). The identical rules also run client-side as
`localMatchEngine` for previewing without a deployed function
(`VITE_LOCAL_ENGINE=1`) — that path is **not** trusted for coins.

## Getting started

Needs [Docker](https://docs.docker.com/desktop/) (or Rancher/Podman/OrbStack)
running. The Supabase CLI is a devDependency — run it with `npx supabase`.

**1. Backend.** Applies every migration + `seed.sql`, then prints the URLs and
keys:

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

Both are long-running processes and **both must be up**: `supabase start` serves
no app, and `npm run dev` has no backend without it. A dev server that was never
started looks exactly like a broken app — `localhost:5173` simply refuses the
connection.

| | |
|---|---|
| App | http://localhost:5173 |
| Studio | http://localhost:54323 |
| API | http://127.0.0.1:54321 |

| Command | |
|---|---|
| `npx supabase status` | reprint URLs & keys |
| `npx supabase stop` | stop the stack |
| `npm run db:reset` | re-apply migrations + seed (wipes local data, incl. accounts) |

Local accounts are separate from production — a fresh stack has no users, so
sign up in-app. `enable_confirmations = false` locally, so sign-up logs you
straight in; the mail catcher is at http://localhost:54324.

`config.toml`'s `db.major_version` **must match the remote** (`SHOW
server_version;` there) — local otherwise tests a different Postgres than
production.

For a hosted project instead: `npx supabase link --project-ref <ref> && npm run
db:push`. Always apply migrations with the CLI, never by pasting SQL — a
hand-applied schema leaves the `supabase_migrations.schema_migrations` ledger
empty and the GitHub integration loses track of what's applied.

## Deploying the frontend (Vercel)

The app is a static Vite SPA, so any static host works; Vercel is the smoothest.

1. **Import the repo** in Vercel. The framework preset auto-detects as *Vite* —
   `vercel.json` pins the build command (`npm run build`) and output dir (`dist`)
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

## Project layout

```
supabase/
  migrations/
    0001_schema.sql      tables & enums
    0002_rls.sql         row-level security
    0003_functions.sql   signup trigger + open_pack / save_squad
    0004_match_engine.sql  record_match (service-role) + drops play_match placeholder
  functions/
    play-match/index.ts  self-contained Edge Function (engine bundled in) — DEPLOYED
    _src/play-match.ts   readable source; `npm run build:function` bundles it → index.ts
  seed.sql               cards (decoded from originals) + packs
src/
  lib/        supabase client, domain types
  data/       repositories over Supabase
  game/       abilities, ratings, squad rules (100-pt cap), match engine
    engine/   pure basic-game rules simulation (+ __tests__)
  auth/       AuthProvider (session + profile)
  ui/         BottomNav, CardTile
  screens/    Login, Home, Play, Collection, Store, SquadBuilder
```

## Status & next steps

Foundation is in place: auth, wallet, collection, 100-point squad builder,
store/pack-opening, and a playable loop. The real basic-game dice-and-ability
engine (`src/game/engine/`, unit-tested) is now the **authoritative** resolver via
the `play-match` Edge Function — the `play_match` placeholder is gone.

### Deploying (migrations + resolver)

Deployment is automatic through the **Supabase GitHub integration** (branching):
merging to `main` applies any new `supabase/migrations/**` **and** deploys the
`play-match` Edge Function (declared in `config.toml` as `[functions.play-match]`).
There is no bespoke deploy workflow to maintain.

- **Migrations** are tracked in `supabase_migrations.schema_migrations` on each
  database. The integration applies only files whose version isn't already
  recorded there. **This is why you must apply migrations with the CLI
  (`npm run db:push`), never by pasting SQL** — a hand-applied schema leaves the
  ledger empty, and the integration then can't tell what's applied. If a project
  was ever set up by pasting SQL, bootstrap the ledger once by recording the
  already-applied versions in `supabase_migrations.schema_migrations`.
- **Turn on the required check.** In the Supabase integration settings enable the
  migration status check and make it a **required check** on `main` (GitHub →
  Settings → Branches) so a PR with a failing migration can't merge green and
  silently no-op on production.

The Edge Function is committed **self-contained**
(`supabase/functions/play-match/index.ts` has the engine bundled in). To change the
resolver, edit `supabase/functions/_src/play-match.ts` and run
`npm run build:function`, then commit the regenerated `index.ts` (the integration
deploys the committed file); never hand-edit `index.ts`. Locally, `npx supabase
start` serves the **generated** `index.ts`, so rerun `npm run build:function`
after any `src/game/engine/` change or the local function stays stale.

**Next:** enter the real 55-card *juego básico* + the exact ability scale (the
100-point cap only bites once real star cards exist), then close the engine's
remaining basic-game gaps (pase alto → remate de cabeza, fouls/penalties).
Human-vs-human PvP (async first) comes after that.

> **Seed note:** the catalog ships the 7 cards decoded from original photos plus
> clearly-labelled placeholder base players, so a new account can field a legal
> 16-man squad before the real basic set is digitised. With these cheap cards the
> 100-point cap isn't yet binding (max squad ≈ 65 pts); that changes once the real
> star cards are added.
