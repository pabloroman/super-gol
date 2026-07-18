// The heart of the inference: one overall(30..99) -> a sparse, position-coherent
// set of Super Gol factors, shaped by the player's role.
//
// Model: a card carries only its role's **core** factors (positions.ts). Each core
// factor starts at a baseline of 1, then a points budget — scaled by how far the
// overall sits above a floor — is spent one point at a time down the list, each
// factor capped at 3. Every non-core factor is simply absent, which reads as 0
// (rulebook page 6: «si a un jugador le falta alguno de los factores … es cero»).
// So a journeyman is mostly 1s across a handful of role-appropriate factors; an
// elite forward maxes remate/desmarque; a keeper maxes reflejos. The 0-3 ceiling
// matches the decoded originals in supabase/seed.sql and the rulebook's small
// factor range (a single die + factor clears the TABLA thresholds). Extra/flavour
// attributes are added by hand later in scripts/cards/data/abilities.json.

import type { Abilities, AbilityKey, Rarity } from '../lib/types'
import { roleProfile, zoneForPosition, type RoleProfile } from './positions'

const FACTOR_MAX = 3
const BASELINE = 1
// Budget an elite (overall ≥ 90) player can spend above baseline. Outfielders
// have five signature factors (max +2 each = 10); 9 leaves the fifth just short
// of maxed so even elites keep a little shape. Keepers have two (max +4).
const BUDGET_MAX_OUTFIELD = 9
const BUDGET_MAX_GK = 4
// Overalls below this are all-baseline; the curve saturates around 90.
const OVERALL_FLOOR = 50
const OVERALL_SPAN = 40

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

/** Distribute `budget` points down `core`, one at a time, each factor capped at 3. */
function spend(core: AbilityKey[], budget: number): Abilities {
  const out: Abilities = {}
  for (const k of core) out[k] = BASELINE
  let remaining = budget
  let progressed = true
  while (remaining > 0 && progressed) {
    progressed = false
    for (const k of core) {
      if (remaining <= 0) break
      if ((out[k] ?? 0) < FACTOR_MAX) {
        out[k] = (out[k] ?? 0) + 1
        remaining--
        progressed = true
      }
    }
  }
  return out
}

/**
 * Build the sparse factor blob for a player: only the role's core factors, each
 * at 1..3, everything else absent. Fully deterministic — value follows overall,
 * presence follows position; no randomness.
 */
export function buildAbilities(overall: number, profile: RoleProfile): Abilities {
  const s = clamp((overall - OVERALL_FLOOR) / OVERALL_SPAN, 0, 1)
  const isGk = profile.group === 'GK'
  const budget = Math.round(s * (isGk ? BUDGET_MAX_GK : BUDGET_MAX_OUTFIELD))
  return spend(profile.core, budget)
}

/** Rarity band from overall. */
export function rarityFor(overall: number): Rarity {
  if (overall >= 84) return 'rara'
  if (overall >= 76) return 'frecuente'
  return 'comun'
}

/** Squad-point cost from overall (roughly 1..12, median around 6). */
export function costFor(overall: number): number {
  return clamp(Math.round((overall - 58) / 4.5) + 3, 1, 12)
}

export interface CardFactors {
  abilities: Abilities
  zone_grid: boolean[][]
  cost: number
  rarity: Rarity
  position: string
}

/** Everything the catalog needs to derive from position + overall. */
export function deriveCard(position: string | null | undefined, overall: number): CardFactors {
  const profile = roleProfile(position)
  return {
    abilities: buildAbilities(overall, profile),
    // Demarcación derived from the player's position via the ZONE_BY_POSITION map.
    zone_grid: zoneForPosition(position),
    cost: costFor(overall),
    rarity: rarityFor(overall),
    position: profile.group,
  }
}
