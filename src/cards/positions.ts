// Map Transfermarkt detailed positions onto Super Gol's GK/DF/MF/FW model, and
// hold the per-role factor "profile": a priority-ordered list of the factors
// that define the role. factors.ts spends a budget (scaled by overall) down this
// list, so a role's signature factors are the ones a strong player maxes out.

import type { AbilityKey } from '../lib/types'

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW'

export interface RoleProfile {
  group: PositionGroup
  /** Signature factors, most-defining first. Budget flows down this list. */
  priority: AbilityKey[]
}

// Priority lists are hand-tuned to the rulebook's factor meanings (see
// src/game/abilities.ts): a centre-back is about robo/anticipación, a
// centre-forward about remate/desmarque, a keeper about reflejos/colocación.
const PROFILES: Record<string, RoleProfile> = {
  Goalkeeper: { group: 'GK', priority: ['rf', 'co'] },
  'Centre-Back': { group: 'DF', priority: ['rb', 'a', 'rc', 'pa', 'pl'] },
  'Left-Back': { group: 'DF', priority: ['rb', 'a', 'v', 'pc', 'rg'] },
  'Right-Back': { group: 'DF', priority: ['rb', 'a', 'v', 'pc', 'rg'] },
  'Defensive Midfield': { group: 'MF', priority: ['rb', 'a', 'pc', 'pl', 'rg'] },
  'Central Midfield': { group: 'MF', priority: ['pc', 'pl', 'rg', 'a', 'dl'] },
  'Attacking Midfield': { group: 'MF', priority: ['pc', 'rg', 'dl', 'pl', 'd'] },
  'Left Winger': { group: 'FW', priority: ['v', 'rg', 'd', 'pc', 'rm'] },
  'Right Winger': { group: 'FW', priority: ['v', 'rg', 'd', 'pc', 'rm'] },
  'Centre-Forward': { group: 'FW', priority: ['rm', 'd', 'rc', 'dl', 'v'] },
  'Second Striker': { group: 'FW', priority: ['rm', 'd', 'rg', 'dl', 'pc'] },
}

// Fallback by keyword when Transfermarkt uses a label we haven't mapped.
function fallbackProfile(position: string): RoleProfile {
  const p = position.toLowerCase()
  if (/keeper|goal/.test(p)) return PROFILES['Goalkeeper']
  if (/back|defen/.test(p)) return PROFILES['Centre-Back']
  if (/wing|forward|strik/.test(p)) return PROFILES['Centre-Forward']
  return PROFILES['Central Midfield']
}

export function roleProfile(position: string | null | undefined): RoleProfile {
  if (!position) return PROFILES['Central Midfield']
  return PROFILES[position] ?? fallbackProfile(position)
}

const T = true
const F = false

/** boolean[4][5] effectiveness grids by group (row 0 = own goal, row 3 = attack). */
export const ZONE_GRIDS: Record<PositionGroup, boolean[][]> = {
  GK: [
    [F, F, T, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
  ],
  DF: [
    [F, F, F, F, F],
    [T, T, T, T, T],
    [F, T, T, T, F],
    [F, F, F, F, F],
  ],
  MF: [
    [F, F, F, F, F],
    [F, T, T, T, F],
    [T, T, T, T, T],
    [F, T, T, T, F],
  ],
  FW: [
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, T, T, T, F],
    [T, T, T, T, T],
  ],
}
