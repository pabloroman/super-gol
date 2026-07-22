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

- **The engine is `src/game/board/`** — a turn-based, server-authoritative recreation of
  the **Juego Básico** on a full **22-player 5×6 board**, with **marcaje derived from where
  cards stack** (`derive.ts`'s `marcajeOf`), not rolled. It is **pure, dependency-free,
  seeded and deterministic** (no React/DOM/Node/Supabase imports). Two functions carry the
  rules and are read identically by the UI menu, the server-side validation and the AI:
  `legalActions(state)` and `apply(state, action, rng)` — legality is defined once. Files:
  `state.ts` (serializable `MatchState`/`Phase`), `derive.ts` (geometry + `marcajeOf`),
  `legal.ts`, `reducer.ts` (`apply`), `actions.ts` (the `Action` union + `actionKey`),
  `placement.ts` (`autoPlace`), `ai.ts` (`chooseAction`), `index.ts` (`createMatch`).
- **The pure leaf resolvers stay in `src/game/engine/`** and are reused verbatim by
  `board/`: the TABLA 1/2 contest resolver `dice.ts`, plus `keeper.ts`, `marcaje.ts`,
  `interrupt.ts`, `actions.ts`, `rng.ts`, `events.ts` + `format-es.ts` (the Spanish
  renderer seam), and the board geometry in `pitch.ts` (`ZONE_MAP`/`zoneAt`/`Cell`,
  `COLS`/`ROWS`). The old one-shot `simulateMatch`, its single-carrier `loop.ts`, the
  `Pitch` closure, the old heuristic `ai.ts`, and the `localMatchEngine` /
  `VITE_LOCAL_ENGINE` preview seam were **deleted** once interactive landed — there is one
  engine now, and no `MatchOutcome`.
- **Match length is the tournament 15-turno clock (page 29), a deliberate, documented
  deviation** from basic's unbounded win-by-two-goals: `MatchState.turno` counts changes of
  possession and the match ends at 15, highest score wins, draws allowed. The rationale, the
  corrected page-29 reading, and the other in-scope deviations live in
  `docs/rulebook/DEVIATIONS.md`.
- **Authority — per jugada.** `src/data/matchSession.ts` is the client seam; the
  **`play-match` Supabase Edge Function** runs the identical `src/game/board/` module
  server-side. State lives in `match_sessions` (0014); each jugada is **one authenticated
  call** (`op: start | act | resume | resign`). The invariant that keeps the anti-cheat
  posture across ~100 round trips: **the client never sends state back and never rolls a
  die** — it sends an action id + a `ply` optimistic-concurrency token; the server
  re-derives `legalActions`, rolls dice from a seed it owns (an addressed sub-seed per
  action) and applies exactly one step. A **partial unique index** enforces one active
  session per user (the anti-farming spine). Coins are paid only by `record_match`, via the
  `finish_match_session` `SECURITY DEFINER` RPC (0014), which stamps `matches.id` onto the
  session **inside the paying transaction** so a win can't be replayed; `record_match` now
  **returns that inserted id** (0015, additive). Both are revoked from
  `anon`/`authenticated` and granted only to `service_role`, so the browser can trigger a
  jugada but never forge the scoreline or the coins.
- **Deploying the engine to Deno:** the readable function source is
  `supabase/functions/_src/play-match.ts` (imports the engine via `@/…`).
  `npm run build:function` esbuild-bundles it — engine inlined, `@supabase/supabase-js`
  left as a `npm:` specifier — into the self-contained
  `supabase/functions/play-match/index.ts` that Supabase deploys. Keeping the engine
  self-contained (its own `GameMode` type; only pure cross-module deps — the
  `ratings.ts`/`abilities.ts` helpers, plus `@/game/squad`'s `POINT_CAP` and the
  type-only `Card` shape that `opponent.ts`/`squad.ts` draft against) is what makes this
  bundle clean. **Never hand-edit the generated `index.ts`;** edit the `_src` source and
  rebuild.
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
  The ledger keys on the **version prefix**, not the filename — renaming an
  already-applied `0012_foo.sql` to `0012_bar.sql` makes `migration up` report
  `applied: []` and skip it. Locally, `db:reset` is the way out.

## Auth & signup

- **A trigger that raises on `auth.users` is invisible to the browser.**
  supabase-js turns any 500 into an `AuthRetryableFetchError` and **discards the
  response body**, so an exception from `handle_new_user` reaches Login as the
  literal string `"{}"` — however carefully it is worded. (The raw HTTP body does
  carry it, which makes this easy to "verify" with curl and get wrong.) Anything
  the user must act on has to be **checked before `signUp`**, as the signup form
  does via the `username_available` RPC; the trigger's own exception is only the
  backstop for the race, and stays English and developer-facing.
- **`profiles.username` is a required, unique PUBLIC handle (`0017`).** It names a
  coach in 1v1 matchmaking, so it is `not null`, uniquely owned
  **case-insensitively** (a unique index on `lower(username)`, not the old
  case-sensitive constraint), and format-checked: Instagram-exact — letters,
  digits, `.`, `_`; 3–30 chars; no leading/trailing/consecutive period. The rule
  lives in **`src/lib/username.ts`** and is mirrored by the `profiles_username_format`
  CHECK and `handle_new_user`; **the DB is the authority** and the client copy only
  exists to show a specific Spanish message before the round trip (a trigger
  exception still reaches the browser as `"{}"`). This **reverses `0012`'s
  blank→NULL rule** — the old nullable behavior is gone, `0017` backfills legacy
  NULL/blank rows to `user<hex>` and de-dupes case-collisions before the new index.
  The `'Entrenador'` display fallback in `Home.tsx` / the admin list is now
  defensive only (no row should be null), not an expected state.
- **Login accepts a username OR an email in one field (`0017`).** Supabase Auth
  only signs in by email/phone, so `Login.tsx` sends an input containing `@`
  straight to `signInWithPassword`; anything else is a username resolved by the
  `email_for_login(identifier, password)` RPC. That RPC returns the account email
  **only when the password already verifies** (bcrypt via `extensions.crypt`
  against `auth.users`), so a public username is never mapped to its private email
  by an unauthenticated caller — the deliberate alternative to a plain
  username→email lookup, which would leak PII. A miss returns the generic
  "Usuario o contraseña incorrectos" so username existence is not revealed.
- **Every auth failure is shown in Spanish; GoTrue's English never leaks.** The
  app is Spanish-only, so `Login.tsx` never renders `error.message` raw — it
  routes every caught auth/RPC error through `authErrorMessage`
  (`src/lib/authErrors.ts`), which branches on the stable `error.code`
  (`invalid_credentials`, `weak_password`, …) with an English-message fallback
  and a Spanish generic for anything unrecognised. The mapper also returns a
  `field` so the message lands under `email`/`password`; client-side validation
  (handle format via `usernameError`, the `PASSWORD_MIN` check, availability)
  shows per-field too, with a live hint under the username and password inputs.
  The signup form is `noValidate` on purpose — native browser bubbles are
  locale-dependent English, so we own the messages instead.

## Waitlist & invites

- **The registration gate is a single flag** — `app_settings.waitlist_enabled`
  (`0021`), toggled from Admin → **Lista de espera**. While on, the landing page
  shows the waitlist email form and a `BEFORE INSERT` trigger on `auth.users`
  (`enforce_signups_open`) refuses signups; signing *in* is never affected. Its
  raise reaches the browser as `"{}"` (same as any `auth.users` trigger, see Auth
  & signup), so it stays English/developer-facing.
- **Invites are an allowlist on top of that gate (`0022`).** Each `waitlist` row
  has a nullable `invited_at`; the trigger admits an email whose row is invited
  even while gated, and refuses everyone else. So the gate can stay closed to the
  public while invited people register — a batched rollout, not all-or-nothing.
- **`send-invites` Edge Function** (`supabase/functions/send-invites/index.ts`,
  `verify_jwt` in `config.toml`) does the inviting: admin-only (mirrors
  `play-match`'s user-JWT verify + service-role client), it marks the selected
  still-pending rows `invited_at = now()` and emails each a Spanish invite linking
  to `${SITE_URL}/?invite=<id>`. Email is direct SMTP via **denomailer** over the
  **same Cloudflare SMTP that Supabase Auth already uses** — no new provider; set
  the same creds as function secrets: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`,
  `SMTP_PASSWORD`, `INVITE_FROM_EMAIL`, `SITE_URL`. Edge Functions restrict some
  outbound SMTP ports, so use **465/TLS** (587 auto-STARTTLS); GoTrue is a separate
  service and isn't subject to that limit, which is why the same SMTP works for auth
  mail. If `SMTP_HOST` is unset (local dev) the send is skipped and logged so the
  flow is testable without a mail server. **Marking is done under service_role, not
  an admin RPC** — `require_admin()` needs an `auth.uid()` a service key lacks (same
  constraint `push:cards` documents).
- **The invite link reveals the signup form.** `App.tsx`'s `Unauthenticated`
  reads `?invite=<id>`, resolves it via the anon `waitlist_invite_email(id)` RPC
  (returns the email only for an invited row — the random uuid is a magic-link-style
  bearer token), and renders `Login` in signup mode with the email pre-filled +
  **locked** (`Login.tsx`'s `inviteEmail` prop), bypassing the gate's UI hiding.
  The trigger stays the real boundary; the link and the lock are UX that keep an
  invited visitor from hitting the opaque `"{}"` refusal with a mismatched email.

## Card catalog pipeline (real players)

The seasonal LaLiga catalog is **generated**, not hand-written. The pure
inference core lives in **`src/cards/`** (shared by the app and the generator,
like `src/game/engine/`); the offline generator in **`scripts/cards/`** reads a
vendored snapshot of the [virtua-fc](https://github.com/pabloroman/virtua-fc)
project's `data/2025/ESP1/teams.json` (Transfermarkt rosters + market value) and
emits two artifacts from one shared row builder: the local catalog **seed**
`supabase/seed_cards.sql` (`build:cards`) and the admin-import CSV
`scripts/cards/data/laliga-2025-cards.csv` (`export:cards:csv`). **The catalog is
not a migration** — it is a dynamic, admin-owned table, seeded locally for
`db:reset` and bootstrapped/refreshed on production through the admin CSV import.
Because the source has no
ability breakdown, factors are **inferred**: market value + age → a single
overall (`src/cards/valuation.ts`, a faithful port of virtua-fc's
`PlayerValuationService`) → a **sparse, position-coherent** set of factors via
per-position **core** templates (`src/cards/factors.ts` / `positions.ts`), on a
0–3 scale. A card carries only its role's core factors (values 1–3); every other
factor is **absent** and reads as 0 (rulebook page 6). Presence follows position
(robo `rb` only on defenders/defensive-mids, remate `rm` only on attackers);
magnitude follows overall (a pricier player scales the same core keys higher — it
never adds or removes a key). `scripts/cards/rows.ts` wires these into card rows
for both emitters.
Photos hotlink virtua-fc's own public CDN: `photos.ts` maps each Transfermarkt id
→ SofaScore id and stores the direct `assets.virtuafc.com/players/{sofascoreId}.webp`
URL in `image_url` (identical on every environment, so it's baked straight into
the seed and the CSV). `Naipe` renders it with a silhouette fallback.

**The inferred factors are still a partial model** — a tracked gap, not a bug to
fix incidentally. The rulebook defines **17** factors (pages 2–3) but `AbilityKey`
carries 13: `f` (falta), `lf` (lanz. faltas), `sa` (salida por alto) and `sp`
(salida a los pies) are missing, so a real card like Hierro's cannot be
represented. The 0–3 ceiling above is an **assumption** — the rulebook states no
range anywhere (only the floor, page 6: a missing factor is zero) and real cards
show a 4. The generator emits a clean **functional core** per role and nothing
more; any per-card variety or extra attributes are added **by hand** through the
overlay (below), not rolled.

**Card ids are `{transfermarktId}-{season}`** (e.g. `401530-2526`) — the
Transfermarkt id from the snapshot plus the season tag. This is deliberate: the
catalog is a **live** table re-pulled mid-season, and the Transfermarkt id is stable
across the name and club changes a re-pull brings (a transfer, a diacritic fix), so a
re-pull **updates a card in place** instead of forking it into a duplicate that
orphans owners (via the `user_cards` / `squad_slots` FKs) and strands hand-edits. The
season stays in the key so the same player next season is a distinct card; `buildRows`
throws on a duplicate id (a snapshot data error). The old `{name-slug}-{club}-{season}`
scheme baked two volatile fields into the PK and was abandoned for exactly this reason.

**Hand-authored fields live in `scripts/cards/data/overrides.json`**, a JSON
**overlay** keyed by card id — the hand-editable source of truth. Each entry can
override **any** card field, not just abilities:
`{ label, abilities?, cost?, rarity?, name?, … }`, shallow-merged over the derived row
(`abilities` replaces the derived set wholesale; anything not named stays derived).
`label` (`"Éder Militão · Real Madrid"`) is descriptive only — ignored by the build,
it keeps the opaque numeric keys navigable while hand-editing. `npm run reseed:cards`
writes the file from the deterministic generator (the ONLY writer; re-running is an
empty diff, so it can't silently churn hand-edits); thereafter you edit it directly.
Both emitters read it, so a hand-edit flows into `seed_cards.sql` (fresh local
`db:reset`) and the CSV, and via `npm run push:cards` into a live database.
`push:cards` writes ONLY the `abilities` column with the **service_role** key
(bypasses RLS; the `admin_upsert_cards` RPC is unusable — its `require_admin()` needs
an `auth.uid()` a service key lacks), is **dry-run by default**, and knowingly
overwrites in-app admin ability edits for the cards it touches; a hand-edited *scalar*
(cost, rarity, name…) reaches prod through the admin CSV import, not `push:cards`.
Because the catalog is a local-only seed (`seed_cards.sql`, guarded off hosted DBs)
plus the admin CSV import on prod, never a migration, prod catalog and ability changes
go through the admin importer and `push:cards`; local `db reset` and a push both derive
from `overrides.json`, so they converge.

- `npm run reseed:cards` — (re)write `overrides.json` from the deterministic core.
  Run once to bootstrap, or after re-vendoring a roster to bake in new players
  (existing cards diff empty). **This clobbers hand-edits** — it's the reset button.
- `npm run build:cards` — regenerate **both** catalog artifacts from `overrides.json`
  (offline; no credentials): the local **seed** `supabase/seed_cards.sql` **and** the
  admin CSV (chains `export:cards:csv` after the seed). They share one derivation
  (`buildRows`) and must never drift, so the everyday "I changed a card, refresh"
  command emits both — and only this one prunes the SofaScore photo map, which the CSV
  emit then reads. Never hand-edit the generated seed — edit `overrides.json`
  (abilities + any hand-authored field) or `scripts/cards/` + `src/cards/` (derivation
  logic) and re-run. Refresh a season by re-vendoring the JSON snapshots under
  `scripts/cards/data/`.
- `npm run export:cards:csv` — the CSV-only subset of `build:cards`: emit just
  `scripts/cards/data/laliga-2025-cards.csv` (the catalog in the admin importer's column
  shape, carrying `is_starter` so importing it into a fresh e.g. wiped prod DB
  bootstraps the catalog **and** the 55-card starter deck,
  `scripts/cards/data/starter-deck.ts`). Kept for the prod-bootstrap flow, which wants
  the CSV without touching the local seed; assumes the photo map is already pruned (run
  `build:cards` for a full refresh).
- `npm run push:cards` — apply `overrides.json`'s abilities to a live DB (dry-run
  unless `-- --commit`; needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).

## The naipe (card UI)

`src/ui/naipe/Naipe.tsx` reproduces the physical card, and
**`docs/rulebook/pages/page-02.md` («LA CARTA:») is the spec** — read it before
changing anything here. Rules that page settles, each of which the code got wrong
once already:

- The roundel is the **ficha** = `cost`. The original printed it «en rojo si es
  extranjero» (page 2) to flag the foreigners a squad's roster limit capped, but
  **this version has no origin-based squad rule**, so the ficha always prints
  black and cards carry no foreigner marking — nationality is shown as plain
  information in the detail sheet, nothing more.
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
`seed_cards.sql` is just the local initial seed, and a local `db reset` would revert
admin edits (prod is never reset from it — its catalog comes from the CSV import).

The catalog is a list below `md` and a real `<table>` above it, from **one render**
(`CardRow`) — the 518 rows are unvirtualized, so a second hidden mobile copy would
double the DOM. The editor is a `Sheet` wrapping a `<form>`: **every button that
isn't Guardar needs `type="button"`**, since the default inside a form is submit
and a missed one turns Cancelar into a save. Search is `useCardFilters` with
`searchId: true` — that flag is opt-in because ids are `{transfermarktId}-{season}`,
so matching them by default would make "2526" return all 518 cards in Colección while
helping no one search. Its `getCard` must stay at module scope (it's a `useMemo` dep).

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
  migrations, then the seed files (`seed_cards.sql` + `seed.sql`, in that order);
  point the app at it with a `.env.local` override. The catalog and starter deck are
  a **local seed** (`seed_cards.sql`, generated); packs are a migration (`0008`); and
  `seed.sql` itself only seeds two local dev accounts, `admin@supergol.test` and
  `coach@supergol.test` / `password123`, documented in `INSTALL.md`. It creates them
  by inserting into `auth.users` and letting `handle_new_user` do the rest, so they
  are built by the same path as a live signup; a guard raises unless the database is
  the local stack. `npm run db:reset:linked` passes `--no-seed` so the seed never runs
  on a remote; the guard is the backstop for a bare `supabase db reset --linked`.
- `npm run typecheck` — `tsc -b --noEmit` (also checks tests)
- `npm run test` — Vitest run (engine tests in `src/game/engine/__tests__/`,
  catalog inference + CSV tests in `src/cards/__tests__/`)
- `npm run build` — typecheck + production build
- `npm run reseed:cards` — (re)write `scripts/cards/data/overrides.json` from the
  deterministic core (clobbers hand-edits; see above)
- `npm run build:cards` — regenerate **both** catalog artifacts: the local seed
  `seed_cards.sql` and the admin CSV (see above)
- `npm run export:cards:csv` — regenerate only the importable catalog CSV (the CSV-only
  subset of `build:cards`)
- `npm run push:cards` — push `overrides.json` abilities to a live DB (dry-run
  unless `-- --commit`; see above)
