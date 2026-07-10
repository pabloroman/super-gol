import type { MatchEventType, MatchEventParams, AbilityKey } from '@/lib/types'
import type { Side, Marcaje } from './types'
import type { Contest } from './dice'
import type { Cell } from './pitch'

/**
 * Structured chronicle events. The loop emits these (without a minute); the
 * public entry point stamps a minute and renders Spanish text via `format-es`.
 * Keeping events structured means a future English renderer needs no engine
 * changes — the Spanish rulebook terminology stays the source of truth.
 */
export interface EngineEvent {
  type: MatchEventType
  side: Side
  params: MatchEventParams
}

export function ev(
  type: MatchEventType,
  side: Side,
  params: MatchEventParams = {},
  cell?: Cell,
): EngineEvent {
  return { type, side, params: cell ? { ...params, cell } : params }
}

/** Convenience for events that carry a contest roll. */
export function evContest(
  type: MatchEventType,
  side: Side,
  opts: {
    player?: string
    target?: string
    ability?: AbilityKey
    marcaje?: Marcaje
    contest: Contest
    cell?: Cell
  },
): EngineEvent {
  return {
    type,
    side,
    params: {
      player: opts.player,
      target: opts.target,
      ability: opts.ability,
      marcaje: opts.marcaje,
      dice: opts.contest.dice,
      total: opts.contest.total,
      success: opts.contest.success,
      cell: opts.cell,
    },
  }
}
