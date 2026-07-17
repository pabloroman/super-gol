/**
 * The interactive basic-game board engine.
 *
 * A serializable, dependency-free, deterministic model of a played match — the
 * turn-based counterpart to `../engine`'s one-shot `simulateMatch`. It reuses that
 * module's pure resolvers (dice, actions, keeper, marcaje) but replaces the
 * single-carrier narrative loop with all 22 cards on the board and marcaje derived
 * from where they stand. Phases 2+ add `legalActions`/`apply`; this barrel currently
 * exposes the state model and `createMatch`.
 */

import type { EngineSquad, Difficulty } from '../engine/types'
import type { MatchState } from './state'
import { STATE_VERSION } from './state'
import { autoPlace, kickoffCarrier } from './placement'

export * from './state'
export * from './derive'
export * from './actions'
export { legalActions } from './legal'
export { apply } from './reducer'
export { autoPlace, kickoffCarrier } from './placement'

export interface CreateMatchInput {
  home: EngineSquad
  away: EngineSquad
  difficulty: Difficulty
}

/**
 * Build a fresh, auto-placed match ready for the opening kickoff. Both sides are
 * arranged by `autoPlace`; the human (home) kicks off, so the ball starts on home's
 * centre-forward and the phase is the mandatory opening pase directo. The drag
 * placement editor (Phase 5) mutates this before play; the AI accepts it as-is.
 */
export function createMatch(input: CreateMatchInput): MatchState {
  const players = { ...autoPlace(input.home, 'home'), ...autoPlace(input.away, 'away') }
  const carrier = kickoffCarrier('home')
  return {
    version: STATE_VERSION,
    players,
    ball: { carrier, cell: players[carrier].cell },
    attacker: 'home',
    phase: { kind: 'kickoff', side: 'home' },
    libre: null,
    score: { home: 0, away: 0 },
    turno: 0,
    ply: 0,
    antiStall: { pdChain: [], movedTo: {}, movesRun: 0 },
    difficulty: input.difficulty,
  }
}
