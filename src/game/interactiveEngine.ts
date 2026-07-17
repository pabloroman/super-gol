/**
 * Client-side starter for the interactive basic game. Builds the two squads exactly
 * like `localMatchEngine` (same `buildEngineSquad` + `generateOpponent`) and hands back
 * a fresh `MatchState` plus the seed the caller uses to drive dice.
 *
 * NOT authoritative — this runs the rules in the browser for a playable preview, so it
 * pays no coins. Phase 4 moves the state and the dice server-side; this file is the
 * temporary local path that makes the game playable end to end first.
 */

import { fetchActiveSquad, fetchCatalog } from '@/data/api'
import { buildEngineSquad } from '@/game/engine/squad'
import { generateOpponent } from '@/game/engine/opponent'
import { seedFrom, createRng } from '@/game/engine/rng'
import type { Difficulty } from '@/game/engine/types'
import { createMatch, type MatchState } from '@/game/board'

export interface InteractiveStart {
  state: MatchState
  /** Seed for the match-driving RNG (dice). Client-side only, so not a secret here. */
  seed: number
  opponent: string
}

export async function startInteractiveMatch(difficulty: Difficulty): Promise<InteractiveStart> {
  const [squad, catalog] = await Promise.all([fetchActiveSquad(), fetchCatalog()])
  if (!squad) throw new Error('Todavía no tienes equipo')
  const home = buildEngineSquad(squad.name || 'Tu equipo', squad, catalog)
  const seed = seedFrom(Date.now(), difficulty, squad.id)
  const away = generateOpponent(difficulty, createRng(seedFrom(seed, 'opponent')))
  return {
    state: createMatch({ home, away, difficulty }),
    seed: seedFrom(seed, 'dice'),
    opponent: away.name,
  }
}
