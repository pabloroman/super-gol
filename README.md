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
| Game logic | Postgres RPCs (`SECURITY DEFINER`) — server-authoritative economy & results |

### Why server-authoritative?

Currency, pack pulls and match results **cannot be trusted to the client** or a
player could grant themselves coins and perfect cards. Row Level Security lets
clients *read* only their own rows; every sensitive write goes through a
Postgres function that the client can call but not forge:

- `open_pack(pack_id)` — charge coins, roll cards by rarity weights, grant them.
- `save_squad(...)` — validate ownership, 11+5 counts, and the 100-point cap.
- `play_match(difficulty)` — resolve a match and award coins.

## The match engine is pluggable

Match resolution currently lives in `play_match` as a **placeholder** (squad
strength → scoreline with weighted randomness). The real Super Gol rules
(the `d6 + ability + pitch-zone` simulation) will drop in behind the same
interface — see `src/game/engine.ts` — most likely as a Supabase Edge Function
sharing a TypeScript engine module. **No screen changes when that lands.**

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

## Project layout

```
supabase/
  migrations/
    0001_schema.sql      tables & enums
    0002_rls.sql         row-level security
    0003_functions.sql   signup trigger + open_pack / save_squad / play_match
  seed.sql               cards (decoded from originals) + packs
src/
  lib/        supabase client, domain types
  data/       repositories over Supabase
  game/       abilities, squad rules (100-pt cap), match engine interface
  auth/       AuthProvider (session + profile)
  ui/         BottomNav, CardTile
  screens/    Login, Home, Play, Collection, Store, SquadBuilder
```

## Status & next steps

Foundation is in place: auth, wallet, collection, 100-point squad builder,
store/pack-opening, and a playable loop with a placeholder match. Validated
end-to-end (schema, RLS, RPC guard rails).

**Next:** enter the real 55-card *juego básico* + the exact ability scale, then
replace `play_match` with the real dice-and-ability engine. Human-vs-human PvP
(async first) comes after that.

> **Seed note:** the catalog ships the 7 cards decoded from original photos plus
> clearly-labelled placeholder base players, so a new account can field a legal
> 16-man squad before the real basic set is digitised. With these cheap cards the
> 100-point cap isn't yet binding (max squad ≈ 65 pts); that changes once the real
> star cards are added.
