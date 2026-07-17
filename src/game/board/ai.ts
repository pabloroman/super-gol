/**
 * A minimal opponent for the interactive game: heuristic scoring over `legalActions`,
 * not a search. It exists so the away side can play every phase the human faces — this
 * is the thin version that makes a match playable end to end; Phase 3 replaces it with a
 * difficulty-tuned manager. Because it only ever picks from `legalActions`, every choice
 * it makes is legal by construction.
 */

import type { Rng } from '../engine/rng'
import type { Action } from './actions'
import type { MatchState, Side, Cell } from './state'
import { legalActions } from './legal'
import { distance, zoneOf } from './derive'

/** How far a cell is along a side's attack (higher = closer to the goal it attacks). */
function progress(side: Side, cell: Cell): number {
  return side === 'home' ? cell.row : 5 - cell.row
}

function ballCell(state: MatchState): Cell {
  return state.ball.cell
}

/** Score a single candidate action; higher is better. Noise is added by the caller. */
function score(state: MatchState, action: Action): number {
  const me = state.phase.kind === 'fulltime' ? 'home' : (state.phase as { side: Side }).side
  const players = state.players

  switch (action.kind) {
    case 'shot':
      // Shooting is the point; a close-range remate beats a long shot.
      return action.shot === 'RM' ? 90 : 70
    case 'pass': {
      const to = players[action.to]
      // Prefer passes that move the ball forward; a cesión (to keeper) is a last resort.
      const forward = progress(me, to.cell) - progress(me, ballCell(state))
      return 30 + forward * 6
    }
    case 'hueco': {
      const forward = progress(me, action.to) - progress(me, ballCell(state))
      return 25 + forward * 5
    }
    case 'regate':
      return 35
    case 'move': {
      const mover = players[action.player]
      const forward = progress(me, action.to) - progress(me, mover.cell)
      // Nudge play forward, and value pressing the ball when defending.
      const towardBall = -distance(action.to, ballCell(state))
      return 10 + forward * 2 + (state.attacker === me ? 0 : towardBall)
    }
    case 'anticipacion':
    case 'robo':
      // Worth a go, but the failed-attempt gift means it isn't a certainty.
      return 40
    case 'decline':
      return 30
    case 'robo_advance': {
      const holder = players[state.ball.carrier!]
      return 20 + (progress(me, action.to) - progress(me, holder.cell)) * 4
    }
    case 'decline_advance':
      return 15
    case 'recover': {
      // Take possession with the player deepest (safest) in our own half.
      const p = players[action.player]
      return 50 - progress(me, p.cell)
    }
    case 'premove':
      return 5
    case 'premove_done':
      return 20 // usually just restart
    case 'keeper_pass': {
      const to = players[action.to]
      return 20 + progress(me, to.cell)
    }
    case 'keeper_hueco':
      return 10
    case 'place':
    case 'placement_done':
      return 0
  }
}

/** Choose the away (or any AI) side's action for the current phase. */
export function chooseAction(state: MatchState, rng: Rng): Action {
  const options = legalActions(state)
  if (options.length === 0) throw new Error('AI asked to act with no legal actions')

  // In the box, take a shot when one is available rather than over-elaborating.
  const carrier = state.ball.carrier ? state.players[state.ball.carrier] : null
  if (carrier && zoneOf(carrier.cell) === 'RM') {
    const rm = options.find((a) => a.kind === 'shot' && a.shot === 'RM')
    if (rm && rng.chance(0.7)) return rm
  }

  let best = options[0]
  let bestScore = -Infinity
  for (const a of options) {
    const s = score(state, a) + rng.next() * 8
    if (s > bestScore) {
      bestScore = s
      best = a
    }
  }
  return best
}
