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

## Layout — mobile-first, one breakpoint

The app is mobile-first and responsive up to the desktop. A few rules hold the
whole thing together:

- **`md` (768px) is the only structural breakpoint.** Nav, `Sheet`, Play's outcome
  and the Admin table all switch there; `lg`/`xl` only adjust grid density.
  **`sm:` is useless here and is always a bug** — below `md` the content column is
  pinned at 448px regardless of viewport, so an `sm:` rule fires at a 640px
  viewport while its box is still phone-width.
- **Width comes from `.app-measure` / `.app-wide`** (`src/index.css`), never a raw
  `max-w-*` on a screen. Both are 448px below `md`, so mobile is untouched by
  definition; above it they open to 672px (reading column) and 1152px (grid
  column). `main` is `.app-wide`; screens that are mostly prose and buttons
  (Home, Tienda, the rival picker) opt down to `.app-measure`.
- **Responsive utilities append, never replace.** Write `max-w-md md:max-w-3xl`,
  not `md:max-w-3xl` alone — the base utility is the phone's rendering and must
  survive. Media queries add no specificity, so a base rule emitted *after* its
  override silently wins.
- **`--topbar-h` (`src/index.css`) is the TopBar's height**, exposed as Tailwind's
  `h-topbar` / `top-topbar`. Anything sticking below the bar offsets by it. Never
  hard-code the pixel value — the bar is taller above `md`, where it carries the
  nav tabs.
- **`hover:` fires on touch.** Tailwind emits it unconditionally (no
  `future.hoverOnlyWhenSupported`), and mobile browsers apply `:hover` on tap and
  leave it stuck. Desktop-only affordances must be **`md:hover:`**.
- **Tailwind's content scanner is regex over raw file text, comments included.**
  Writing a class name in prose emits that rule as dead CSS. Describe utilities
  without spelling them (this has already shipped dead rules twice).
- `TABS` (`src/ui/nav.ts`) is the single nav list — the BottomNav below `md`, the
  TopBar's inline tabs above it.

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
- **Migrations deploy via the Supabase GitHub integration** on merge to `main`
  (it also deploys `play-match` from `config.toml`, so there's no separate deploy
  workflow). It tracks applied files in `supabase_migrations.schema_migrations`, so
  **always apply migrations with `npm run db:push` / `db:reset`, never by pasting
  SQL into the editor** — a hand-applied schema leaves the ledger empty and the
  integration can't reconcile what's applied (new migrations then silently fail to
  apply). New migrations must have a version above the highest already recorded.

## Card catalog pipeline (real players)

The seasonal LaLiga catalog is **generated**, not hand-written. The pure
inference core lives in **`src/cards/`** (shared by the app and the generator,
like `src/game/engine/`); the offline generator in **`scripts/cards/`** reads a
vendored snapshot of the [virtua-fc](https://github.com/pabloroman/virtua-fc)
project's `data/2025/ESP1/teams.json` (Transfermarkt rosters + market value) and
emits `supabase/migrations/0005_cards_laliga_2025.sql`. Because the source has no
ability breakdown, factors are **inferred**: market value + age → a single
overall (`src/cards/valuation.ts`, a faithful port of virtua-fc's
`PlayerValuationService`) → the thirteen Super Gol factors via per-position
priority templates (`src/cards/factors.ts` / `positions.ts`), on a 0–3 scale.
`scripts/cards/rows.ts` wires these into card rows for both emitters.
Photos hotlink virtua-fc's own public CDN: `photos.ts` maps each Transfermarkt id
→ SofaScore id and stores the direct `assets.virtuafc.com/players/{sofascoreId}.webp`
URL in `image_url` (identical on every environment, so it's baked straight into
the migration). `Naipe` renders it with a silhouette fallback.

**The generated factors are known to be unfaithful** — a tracked gap, not a bug to
fix incidentally. The rulebook defines **17** factors (pages 2–3) but `AbilityKey`
carries 13: `f` (falta), `lf` (lanz. faltas), `sa` (salida por alto) and `sp`
(salida a los pies) are missing, so a real card like Hierro's cannot be
represented. The 0–3 ceiling above is an **assumption** — the rulebook states no
range anywhere (only the floor, page 6: a missing factor is zero) and real cards
show a 4. And `buildAbilities` baselines every key to 1, so cards are dense where
the rulebook says the row «varía de una carta a otra» (page 2) — which yields just
54 distinct ability blobs across 518 cards. Until that is reworked, the UI picks a
display subset (`src/ui/naipe/factors.ts`).

- `npm run build:cards` — regenerate the catalog SQL (offline; no credentials).
  Never hand-edit the generated migration — edit `scripts/cards/` + `src/cards/`
  and re-run. Refresh a season by re-vendoring the two JSON snapshots under
  `scripts/cards/data/`.
- `npm run export:cards:csv` — emit `scripts/cards/data/laliga-2025-cards.csv`,
  the same catalog in the admin importer's column shape.

## The naipe (card UI)

`src/ui/naipe/Naipe.tsx` reproduces the physical card, and
**`docs/rulebook/pages/page-02.md` («LA CARTA:») is the spec** — read it before
changing anything here. Rules that page settles, each of which the code got wrong
once already:

- The roundel is the **ficha** = `cost`, and prints **red for a foreigner**
  («En rojo si es extranjero») — 227 of 518 cards. `isForeign` accepts both
  spellings, since `0005` stores English exonyms (`'Spain'`) and `seed.sql` stores
  Spanish (`'España'`).
- The demarcación prints **the player's zone in red**, green elsewhere. The
  `zone_grid` data is right (`true` = the zone, attacking-up); only the colour was
  inverted.
- The factor row is **variable-length by design** — «Cada carta sólo lleva las
  características de las que está dotado el jugador».

The card is a fixed 62×95 aspect (`aspect-naipe`) whose type must track its width,
so the root is a **container** and everything inside is sized in `cqw`: the naipe
fills whatever box it's given, from the picker chip to the full card in the sheet.
`variant="full"` adds the Spanish factor labels from `ABILITY_META`.

Which factors print is `src/ui/naipe/factors.ts`. It branches on `position === 'GK'`
and must **not** use `isGoalkeeper` from `src/game/ratings.ts` — that answers
"which starter keeps goal" and falls back to `rf > 0 || co > 0`, which as a display
rule would render any outfielder carrying a stray keeper rating as a portero.

Club crests are a slug→URL map in `src/cards/clubs.ts` (`crestUrl`), not a DB
column — same reasoning as `image_url`: the URL is identical everywhere. Refresh it
alongside `CLUB_SLUGS` when re-vendoring a season.

`src/ui/Sheet.tsx` is the app's only overlay primitive (portal, focus trap, Escape,
scroll lock, focus restore) and everything modal goes through it — a bottom sheet
below `md`, a centered dialog above. `size` (`'default' | 'wide'`) sets the desktop
width only. Don't build a second overlay: the hand-rolled modal that used to live
in `Admin.tsx` had none of the above, which is exactly why it isn't there anymore.

## Admin UI

Admins (a `profiles.is_admin` flag, set only in the DB) get an in-app screen
gated in `App.tsx`'s TopBar. `src/screens/Admin.tsx` is only the **shell**: the
gate plus a local-state tab switcher over two sibling screens, **`AdminCards.tsx`**
(catalog) and **`AdminUsers.tsx`** (users). Tabs, not routes — two views of one
screen, and `/admin` is deliberately absent from `TABS` in `src/ui/nav.ts`. The
inactive tab is unmounted, so the 518-row catalog isn't left in the DOM behind
Usuarios. **The gate is UX, not security**: every write re-checks `is_admin`
server-side, so a forged client flag reveals empty screens and nothing else.

### Cartas

**Edit individual cards** and **import a full-card CSV**. Writes go through the
SECURITY DEFINER RPCs `admin_upsert_cards` / `admin_delete_card`
(`0006_admin_cards.sql`), which verify `is_admin` server-side — same posture as
the economy RPCs; `cards` RLS is unchanged. CSV parsing/serialization is
`src/cards/csv.ts` (one column per field + one per ability; `zone_grid` derived
from `position`). **Once cards are edited in-app the DB is the source of truth** —
`0005` is just the initial seed, and a `db reset` would revert admin edits.

The catalog is a list below `md` and a real `<table>` above it, from **one render**
(`CardRow`) — the 518 rows are unvirtualized, so a second hidden mobile copy would
double the DOM. The editor is a `Sheet` wrapping a `<form>`: **every button that
isn't Guardar needs `type="button"`**, since the default inside a form is submit
and a missed one turns Cancelar into a save. Search is `useCardFilters` with
`searchId: true` — that flag is opt-in because ids are slugs of name+club+season,
so matching them by default would make "rma" return every Real Madrid card in
Colección. Its `getCard` must stay at module scope (it's a `useMemo` dep).

### Usuarios

List every profile, adjust a wallet, and grant/revoke `is_admin`, through
`admin_list_users` / `admin_adjust_coins` / `admin_set_admin`
(`0011_admin_users.sql`), all behind the same `require_admin()` guard `0006`
added. Notes that are easy to get wrong:

- **RLS is unchanged and must stay that way.** `0002` lets a client read only its
  own `profiles` row; the list is an admin-only RPC that bypasses it as owner,
  *not* a widened policy. `admin_list_users` also joins `auth.users` for the
  email — admin-only PII, which is why it is an RPC and not a view.
- **`admin_adjust_coins` takes a signed amount and writes a `transactions` row**
  (`kind: 'admin_adjust'`), like every other coin movement — a grant that skipped
  the ledger would stop it summing to the balance. It locks the wallet row
  (`for update`) as `open_pack` does, and pre-checks the balance because
  `profiles.coins` carries `check (coins >= 0)`.
- **Self-revoke of `is_admin` is refused server-side.** The flag is settable only
  from the DB or by another admin, so the last admin demoting themselves would
  lock it out of the app for good. The checkbox disables on your own row to say
  so before the round trip.
- Editing your own row calls `refreshProfile()` — the TopBar reads coins and the
  admin gear from the auth profile and would otherwise keep stale numbers.

Usuarios reuses Cartas' one-render list/`<table>` shape, but **not**
`useCardFilters` — that hook filters by rarity/position/ficha, which a user has
none of; a name/email substring is the whole of what it needs.

## Commands

- `npm run dev` — dev server
- `npx supabase start` / `stop` / `status` — local Supabase stack (needs Docker).
  The CLI is a devDependency, so it needs the `npx` prefix. `start` applies all
  migrations + `seed.sql`; point the app at it with a `.env.local` override.
- `npm run typecheck` — `tsc -b --noEmit` (also checks tests)
- `npm run test` — Vitest run (engine tests in `src/game/engine/__tests__/`,
  catalog inference + CSV tests in `src/cards/__tests__/`)
- `npm run build` — typecheck + production build
- `npm run build:cards` — regenerate the LaLiga catalog migration (see above)
- `npm run export:cards:csv` — regenerate the importable catalog CSV
