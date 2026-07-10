import type { MatchOutcome, MatchResultKind } from '@/lib/types'
import { createRng } from './rng'
import { runMatch, type MatchState } from './loop'
import { renderEs } from './format-es'
import { OPPONENT_NAMES } from './opponent'
import { initialPitch } from './pitch'
import type { MatchInput } from './types'

export type { MatchInput, EngineCard, EngineSquad } from './types'

/** Coin rewards mirror `record_match` in the DB (win / draw / loss). */
const REWARD: Record<MatchResultKind, number> = { win: 100, draw: 40, loss: 10 }

function resultFor(gf: number, ga: number): MatchResultKind {
  if (gf > ga) return 'win'
  if (gf < ga) return 'loss'
  return 'draw'
}

/**
 * Simulate a full basic-game match and return the existing `MatchOutcome` shape,
 * so screens render it unchanged. Pure and deterministic: the same input (incl.
 * `seed`) always yields the same outcome.
 */
export function simulateMatch(input: MatchInput): MatchOutcome {
  const rng = createRng(input.seed)

  const state: MatchState = {
    home: input.home,
    away: input.away,
    difficulty: input.difficulty,
    attacker: 'home', // the human squad kicks off
    pitch: initialPitch('home'),
    carrier: input.home.outfield[0],
    carrierMark: 'SM',
    gf: 0,
    ga: 0,
    minute: 0,
    possessions: 0,
  }

  const { events, minutes } = runMatch(state, rng)

  const log = events.map((e, i) => ({
    minute: minutes[i] ?? state.minute,
    side: e.side,
    text: renderEs(e),
    type: e.type,
    params: e.params,
  }))

  const result = resultFor(state.gf, state.ga)
  return {
    result,
    opponent: input.away.name || OPPONENT_NAMES[input.difficulty],
    goals_for: state.gf,
    goals_against: state.ga,
    coins_awarded: REWARD[result],
    log,
  }
}
