import type { Abilities } from '@/lib/types'

/**
 * Engine-local domain types. The pure engine deliberately does NOT depend on the
 * database `Card` shape — the adapter in `./squad` maps `Card` down to
 * `EngineCard`. That keeps this module free of Supabase/React so the same files
 * can run inside a Supabase Edge Function later.
 */

/**
 * Game mode. The two product modes double as the AI-skill knob: `friendly` is the
 * weak, odds-blind rival for learning the rules (it pays no coins), `competitive` is
 * the best-decision rival that fields a squad under the human's own 70-point cap.
 * Lives here (not in `@/game/engine`) so the whole engine module stays free of any
 * import that reaches back into browser code — that is what lets the identical files
 * run inside a Supabase Edge Function.
 */
export type GameMode = 'friendly' | 'competitive'

/** A player as the engine sees it: a name and its ratings. */
export interface EngineCard {
  id: string
  name: string
  full_name: string | null
  position: string | null
  abilities: Abilities
}

/**
 * The name to show for a card — the full name, falling back to the surname when a
 * card has none. Mirrors the naipe card face (`full_name ?? name`) so match text
 * and the card use one convention. Serialized states from before `full_name` was
 * threaded in read `undefined ?? name`, degrading safely to the surname.
 */
export const displayName = (c: EngineCard): string => c.full_name ?? c.name

/** One team: exactly 10 outfield players + 1 goalkeeper (basic mode). */
export interface EngineSquad {
  name: string
  outfield: EngineCard[]
  keeper: EngineCard
}

export interface MatchInput {
  home: EngineSquad
  away: EngineSquad
  difficulty: GameMode
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
