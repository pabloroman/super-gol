/**
 * The interactive basic-game board engine — the one match engine.
 *
 * A serializable, dependency-free, deterministic model of a played match: all 22 cards
 * on the board with marcaje derived from where they stand. It reuses the pure resolvers
 * in `../engine` (dice, actions, keeper, marcaje, interrupt) and adds the played-game
 * layer on top — `legalActions`/`apply`, the phase machine, the AI (`ai.ts`), and
 * `createMatch`, all barrelled here.
 */

import type { EngineSquad, GameMode } from '../engine/types'
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
  difficulty: GameMode
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
    possessionJugadas: 0,
    antiStall: { pdChain: [], movedTo: {} },
    difficulty: input.difficulty,
  }
}
