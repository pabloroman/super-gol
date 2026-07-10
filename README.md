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
Edge Function** (`supabase/functions/play-match/`) imports it unchanged (via the
`@/` import map in its `deno.json`), runs the match server-side, and commits the
result through the `service_role`-only `record_match` function — so the browser
can trigger a match but can't forge the result or the coins. The client calls it
through `serverMatchEngine` behind the `MatchEngine` interface
(`src/game/engine.ts`). The identical rules also run client-side as
`localMatchEngine` for previewing without a deployed function
(`VITE_LOCAL_ENGINE=1`) — that path is **not** trusted for coins.

## Getting started

```bash
npm install

# 1. Create a Supabase project at supabase.com
# 2. Configure env
cp .env.example .env      # then fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY

# 3. Apply schema + seed (Supabase CLI, needs Docker), or paste the SQL
#    from supabase/migrations + supabase/seed.sql into the SQL editor.
supabase db reset

npm run dev
```

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

### Deploying the resolver

The Edge Function is committed **self-contained** (`supabase/functions/play-match/index.ts`
has the engine bundled in, so it needs nothing outside itself). Two paths:

- **With the CLI:** `supabase db push` (applies `0004_match_engine.sql`) then
  `supabase functions deploy play-match`. Locally: `supabase start` +
  `supabase functions serve play-match`.
- **Browser only (no local machine):** apply `supabase/migrations/0004_match_engine.sql`
  in the Dashboard **SQL Editor**, and let the `.github/workflows/deploy-play-match.yml`
  GitHub Action deploy the function on push (set the `SUPABASE_ACCESS_TOKEN` secret and
  `SUPABASE_PROJECT_REF` variable in the repo's GitHub settings — see the workflow header).

To change the resolver, edit `supabase/functions/_src/play-match.ts` and run
`npm run build:function` (or let the Action rebuild it); never hand-edit the generated
`index.ts`.

**Next:** enter the real 55-card *juego básico* + the exact ability scale (the
100-point cap only bites once real star cards exist), then close the engine's
remaining basic-game gaps (pase alto → remate de cabeza, fouls/penalties).
Human-vs-human PvP (async first) comes after that.

> **Seed note:** the catalog ships the 7 cards decoded from original photos plus
> clearly-labelled placeholder base players, so a new account can field a legal
> 16-man squad before the real basic set is digitised. With these cheap cards the
> 100-point cap isn't yet binding (max squad ≈ 65 pts); that changes once the real
> star cards are added.
