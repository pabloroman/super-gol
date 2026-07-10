import type { Abilities } from '@/lib/types'

/**
 * Engine-local domain types. The pure engine deliberately does NOT depend on the
 * database `Card` shape — the adapter in `./squad` maps `Card` down to
 * `EngineCard`. That keeps this module free of Supabase/React so the same files
 * can run inside a Supabase Edge Function later.
 */

/**
 * Opponent tier. Lives here (not in `@/game/engine`) so the whole engine module
 * stays free of any import that reaches back into browser code — that is what
 * lets the identical files run inside a Supabase Edge Function.
 */
export type Difficulty = 'easy' | 'normal' | 'hard'

/** A player as the engine sees it: a name and its ratings. */
export interface EngineCard {
  id: string
  name: string
  position: string | null
  abilities: Abilities
}

/** One team: exactly 10 outfield players + 1 goalkeeper (basic mode). */
export interface EngineSquad {
  name: string
  outfield: EngineCard[]
  keeper: EngineCard
}

export interface MatchInput {
  home: EngineSquad
  away: EngineSquad
  difficulty: Difficulty
  seed: number
}

/** Which side is acting. `home` is always the human player's squad. */
export type Side = 'home' | 'away'

/**
 * Marcaje (marking) state of the current ball carrier, from the rulebook:
 * - `SM`  sin marcaje — alone in the cell.
 * - `MZ`  marcaje en zona — a defender "debajo" (below).
 * - `MH`  marcaje al hombre — a defender "encima" (on top).
 * - `LIBRE` libre de marcaje — a prior failed defensive action freed the carrier
 *   for the next jugada. Rolls like `SM` (1 die + 5) but can't be anticipated.
 */
export type Marcaje = 'SM' | 'MZ' | 'MH' | 'LIBRE'
