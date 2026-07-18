// Map Transfermarkt detailed positions onto Super Gol's GK/DF/MF/FW model, and
// hold the per-role factor "profile": the **core** factors that define the role.
// This core list is the card's whole functional attribute set — a card carries
// only these keys (values 1..3), and every other factor is absent (reads as 0,
// rulebook page 6). factors.ts spends a budget (scaled by overall) down the list,
// so a role's most-defining factors are the ones a strong player maxes out. The
// list is deliberately position-coherent: robo (`rb`) lives only on defenders and
// defensive-mids, remate (`rm`) only on attackers. Any extra/flavour attributes
// are added by hand afterwards in scripts/cards/data/abilities.json, never rolled.

import type { AbilityKey } from '../lib/types'

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW'

export interface RoleProfile {
  group: PositionGroup
  /** The role's functional factor set, most-defining first. Budget flows down it. */
  core: AbilityKey[]
}

// Core lists are hand-tuned to the rulebook's factor meanings (see
// src/game/abilities.ts): a centre-back is about robo/anticipación, a
// centre-forward about remate/desmarque, a keeper about reflejos/colocación.
const PROFILES: Record<string, RoleProfile> = {
  Goalkeeper: { group: 'GK', core: ['rf', 'co'] },
  'Centre-Back': { group: 'DF', core: ['rb', 'a', 'rc', 'pa', 'pl'] },
  'Left-Back': { group: 'DF', core: ['rb', 'a', 'v', 'pc', 'rg'] },
  'Right-Back': { group: 'DF', core: ['rb', 'a', 'v', 'pc', 'rg'] },
  'Defensive Midfield': { group: 'MF', core: ['rb', 'a', 'pc', 'pl', 'rg'] },
  'Central Midfield': { group: 'MF', core: ['pc', 'pl', 'rg', 'a', 'dl'] },
  'Attacking Midfield': { group: 'MF', core: ['pc', 'rg', 'dl', 'pl', 'd'] },
  'Left Winger': { group: 'FW', core: ['v', 'rg', 'd', 'pc', 'rm'] },
  'Right Winger': { group: 'FW', core: ['v', 'rg', 'd', 'pc', 'rm'] },
  'Centre-Forward': { group: 'FW', core: ['rm', 'd', 'rc', 'dl', 'v'] },
  'Second Striker': { group: 'FW', core: ['rm', 'd', 'rg', 'dl', 'pc'] },
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

/**
 * Per-role **demarcación** grids (advanced game only — the basic game is played «sin
 * demarcación», rulebook page 11). `boolean[6 rows][5 cols]`, sharing the board's 5×6
 * coordinate system (see src/game/engine/pitch.ts), but in the card's own
 * **attacking-up** frame: row 0 = the attacking end, row 5 = own goal. The engine's
 * `ZONE_MAP` uses **absolute** coords (row 0 = home goal), so the two frames must be
 * reconciled when demarcación lands — along with the LF/RM/DL/RC exceptions that
 * apply regardless of demarcación (rulebook page 3).
 */
export const ZONE_GRIDS: Record<PositionGroup, boolean[][]> = {
  GK: [
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, T, F, F],
  ],
  DF: [
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, T, T, T, F],
    [T, T, T, T, T],
    [F, T, T, T, F],
  ],
  MF: [
    [F, F, F, F, F],
    [F, T, T, T, F],
    [T, T, T, T, T],
    [T, T, T, T, T],
    [F, T, T, T, F],
    [F, F, F, F, F],
  ],
  FW: [
    [F, T, T, T, F],
    [T, T, T, T, T],
    [F, T, T, T, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
  ],
}
