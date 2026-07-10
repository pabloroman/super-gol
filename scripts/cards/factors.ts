// The heart of the inference: one overall(30..99) -> the thirteen Super Gol
// factors, shaped by the player's role.
//
// Model: every factor starts at a baseline of 1 (a professional is competent at
// everything). A points budget, scaled by how far the overall sits above a
// floor, is then spent one point at a time down the role's priority list
// (positions.ts), each signature factor capped at 3. So a journeyman is mostly
// 1s; an elite forward maxes remate/desmarque; a keeper maxes reflejos. The 0-3
// ceiling matches the decoded originals in supabase/seed.sql and the rulebook's
// small factor range (a single die + factor clears the TABLA thresholds).

import type { Abilities, AbilityKey, Rarity } from '../../src/lib/types'
import { roleProfile, ZONE_GRIDS, type RoleProfile } from './positions'

const OUTFIELD_KEYS: AbilityKey[] = ['rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm']
const KEEPER_KEYS: AbilityKey[] = ['rf', 'co']

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

/** Distribute `budget` points down `priority`, one at a time, each capped at +2. */
function spend(priority: AbilityKey[], budget: number): Abilities {
  const out: Abilities = {}
  for (const k of priority) out[k] = BASELINE
  let remaining = budget
  let progressed = true
  while (remaining > 0 && progressed) {
    progressed = false
    for (const k of priority) {
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

/** Build the full 13-factor blob for a player. */
export function buildAbilities(overall: number, profile: RoleProfile): Abilities {
  const s = clamp((overall - OVERALL_FLOOR) / OVERALL_SPAN, 0, 1)
  const isGk = profile.group === 'GK'
  const budget = Math.round(s * (isGk ? BUDGET_MAX_GK : BUDGET_MAX_OUTFIELD))

  const abilities: Abilities = {}
  // Baseline every factor the role's group cares about so a card is never empty.
  const baseKeys = isGk ? [...OUTFIELD_KEYS, ...KEEPER_KEYS] : OUTFIELD_KEYS
  for (const k of baseKeys) abilities[k] = BASELINE

  const spent = spend(profile.priority, budget)
  for (const k of Object.keys(spent) as AbilityKey[]) abilities[k] = spent[k]!
  return abilities
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
    zone_grid: ZONE_GRIDS[profile.group],
    cost: costFor(overall),
    rarity: rarityFor(overall),
    position: profile.group,
  }
}
