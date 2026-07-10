# CLAUDE.md — project guide for AI assistants

Super Gol is a mobile-first PWA recreation of the 1995 Spanish football card game
*Super Gol* (Naipes Heraclio Fournier). Collect cards → build a squad → compete →
earn coins → open packs. Stack: Vite + React 19 + TypeScript + Tailwind, Supabase
(Postgres + Auth + RLS) with server-authoritative game logic.

## Language policy — Spanish terminology always leads

This is the most important convention in the project.

- **The Spanish rulebook terminology is canonical and always leads.** The domain
  vocabulary comes from the original rulebook transcribed in `docs/rulebook/`.
  Use those exact terms as the source of truth for names, keys, and identifiers:
  - Ability ratings by their Spanish abbreviations: **PC** (pase corto), **PL**
    (pase largo), **RG** (regate), **A** (anticipación), **RB** (robo de balón),
    **RM** (remate en el área), **DL** (disparo lejano), plus the goalkeeper
    ratings **RF** (reflejos) and **CO** (colocación). Full labels live in
    `src/game/abilities.ts` (`ABILITY_META`) in Spanish.
  - Marcaje (marking) states: **MH** (marcaje al hombre), **MZ** (marcaje en
    zona), **SM** (sin marcaje), **LIBRE** (libre de marcaje).
  - Action names: pase directo/corto/largo/al hueco, regate, remate, disparo
    lejano, anticipación, robo de balón.
  - Any future translation is a secondary layer and must **never** override or
    rename these canonical Spanish terms.
- **Code and developer-facing text (this file, comments, commit messages,
  identifiers) are written in English.** Domain terms embedded in code keep their
  Spanish form (e.g. `Marcaje`, `carrierMark`, ability keys `pc`/`rm`/`rf`).
- **The product UI is Spanish-only today.** There is no i18n framework and no
  English translation of the app. Bilingual **ES/EN** localization is a recorded
  future goal in which **Spanish leads** — the match engine already funnels all
  chronicle text through a single Spanish renderer (`src/game/engine/format-es.ts`)
  so adding a `format-en.ts` later needs no engine change.

## The rulebook is the source of truth for game rules

`docs/rulebook/` holds a faithful, verified transcription of the original paper
instructions (`pages/page-01.md`…`page-33.md`), the original scans, the master
resolution charts **TABLA 1 & TABLA 2** (`pages/page-30.md`), and a
`VERIFICATION.md` worklist. When a rule is ambiguous in code, the transcription —
and the scans it is based on — decide it. The **Juego Básico** (basic game) spans
pages 1–13; everything from page 18 on is **Juego Avanzado** and out of scope for
the current engine.

## Match engine architecture

- The engine lives in `src/game/engine/` as a **pure, dependency-free, seeded,
  deterministic** TypeScript module (no React/DOM/Node/Supabase imports). Same
  `{ home, away, difficulty, seed }` → identical `MatchOutcome`.
- It implements the **basic game** with a **zone-abstracted** positional model:
  the dice math, marcaje transitions, keeper saves and win-by-two-goals
  termination are rule-faithful, but board position is abstracted to an
  advancement band (`OWN → MID → DL → RM`) behind the `Pitch` interface in
  `pitch.ts`, so a real 6×5 board can drop in later. The core contest resolver
  (TABLA 1/2 as data) is `dice.ts`.
- **Authority:** `serverMatchEngine` in `src/game/engine.ts` invokes the
  **`play-match` Supabase Edge Function**, which runs the identical
  `src/game/engine/` module server-side and commits the result through the
  `record_match` `SECURITY DEFINER` function. `record_match` is revoked from the
  `anon`/`authenticated` roles and granted only to `service_role`, so the browser
  can trigger a match but never forge the scoreline or the coins it pays.
  `localMatchEngine` runs the same rules client-side but is **not** trusted for
  coins — it is a preview path, selected only when `VITE_LOCAL_ENGINE=1`.
- **Deploying the engine to Deno:** the readable function source is
  `supabase/functions/_src/play-match.ts` (imports the engine via `@/…`).
  `npm run build:function` esbuild-bundles it — engine inlined, `@supabase/supabase-js`
  left as a `npm:` specifier — into the self-contained
  `supabase/functions/play-match/index.ts` that Supabase deploys. Keeping the engine
  self-contained (its own `Difficulty` type; only the pure `ratings.ts`/`abilities.ts`
  helpers as cross-module deps) is what makes this bundle clean. **Never hand-edit the
  generated `index.ts`;** edit the `_src` source and rebuild.
- Missing ability ratings count as **0** (rulebook page 6); always read ratings
  through `abilityValue` in `src/game/ratings.ts`, never index `abilities[key]`.

## Conventions

- Import via the `@/` alias (`@/*` → `src/*`); use `import type` for type-only
  imports.
- Client types in `src/lib/types.ts` **mirror the SQL schema**
  (`supabase/migrations/0001_schema.sql`). `abilities`/`zone_grid` are freeform
  `jsonb`, so `Abilities` is a `Partial<Record<AbilityKey, number>>`.
- The economy is **server-authoritative**: currency, pack pulls and match results
  go through `SECURITY DEFINER` Postgres functions
  (`supabase/migrations/0003_functions.sql`); clients can call but not forge them.
  RLS lets clients read only their own rows.
- Screens (`src/screens/`) call the repository layer (`src/data/api.ts`), which
  wraps Supabase — screens never touch the client directly.

## Card catalog pipeline (real players)

The seasonal LaLiga catalog is **generated**, not hand-written. `scripts/cards/`
reads a vendored snapshot of the [virtua-fc](https://github.com/pabloroman/virtua-fc)
project's `data/2025/ESP1/teams.json` (Transfermarkt rosters + market value) and
emits `supabase/migrations/0006_cards_laliga_2025.sql`. Because the source has no
ability breakdown, factors are **inferred**: market value + age → a single
overall (`valuation.ts`, a faithful port of virtua-fc's `PlayerValuationService`)
→ the thirteen Super Gol factors via per-position priority templates
(`factors.ts` / `positions.ts`), on the rulebook's 0–3 scale. Photos hotlink
virtua-fc's own public CDN: `photos.ts` maps each Transfermarkt id → SofaScore id
and stores the direct `assets.virtuafc.com/players/{sofascoreId}.webp` URL in
`image_url` (identical on every environment, so it's baked straight into the
migration). `CardTile` renders it with a silhouette fallback.

- `npm run build:cards` — regenerate the catalog SQL (offline; no credentials).
  Never hand-edit the generated migration — edit `scripts/cards/` and re-run.
  Refresh a season by re-vendoring the two JSON snapshots under
  `scripts/cards/data/`.

## Commands

- `npm run dev` — dev server
- `npm run typecheck` — `tsc -b --noEmit` (also checks tests)
- `npm run test` — Vitest run (engine unit tests in `src/game/engine/__tests__/`,
  catalog inference tests in `scripts/cards/__tests__/`)
- `npm run build` — typecheck + production build
- `npm run build:cards` — regenerate the LaLiga catalog migration (see above)
