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
running. Start the backend, point the app at it, then run the dev server:

```bash
npm install
npx supabase start        # prints the URLs & keys
```

Put the local stack in `.env.local` (gitignored, and Vite loads it ahead of
`.env`, so any remote credentials there stay intact):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable key from the start output>
```

```bash
npm run dev               # in a second terminal; the backend stays up in the first
```

The app is at http://localhost:5173, and a reset stack comes with two dev
accounts — `admin@supergol.test` and `coach@supergol.test`, password
`password123`.

**[INSTALL.md](INSTALL.md) is the full guide**: the dev accounts and how the seed
builds them, resetting the database, and deploying the frontend, the migrations
and the resolver.

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
  seed.sql               two local-only dev accounts (see INSTALL.md); no game data
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

Merging to `main` deploys itself: the **Supabase GitHub integration** applies any
new migration and redeploys the `play-match` Edge Function, with no bespoke
workflow to maintain. [INSTALL.md](INSTALL.md#deploying-migrations--the-resolver)
covers what that requires of you.

**Next:** close the engine's remaining basic-game gaps (pase alto → remate de
cabeza, fouls/penalties), then human-vs-human PvP (async first).
