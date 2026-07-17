/**
 * The AI rival (Phase 3): heuristic scoring over `legalActions`, not a search.
 *
 * It scores every candidate action, adds noise, and takes the max — the same
 * `legalActions` interface the human's UI reads, so the AI plays every phase the human
 * does (placement, attack, the defender reaction windows, the recovery tie-break, the
 * hueco scramble, the keeper restart). Because it only ever picks from `legalActions`,
 * every choice is legal by construction.
 *
 * The scores are expected-value flavoured: each contested action is worth its upside
 * times its true dice odds, minus its downside times the odds of failing. The odds come
 * straight from the same dice model the reducer resolves with (`successProb` below is the
 * closed form of `scoreContest` reaching the target), so a hard AI that trusts them plays
 * real football — it shoots good chances, completes safe passes, and only steals when the
 * numbers favour it.
 *
 * Difficulty is two knobs (plus two minor ones), and the important one is `oddsTrust`:
 * `mix` blends the true probability toward a coin flip, so an odds-blind `easy` AI cannot
 * tell a one-in-six shot from a five-in-six one and is seduced by raw upside — it wastes
 * possessions on hopeless shots and gifts the ball away, which is exactly how a weak
 * player blunders. `hard` sees the real odds and `noise` barely perturbs its choice.
 */

import type { Rng } from '../engine/rng'
import type { Action } from './actions'
import type { MatchState, MatchPlayer, Side, Cell, Difficulty } from './state'
import type { AbilityKey } from '@/lib/types'
import { legalActions, keeperId, other } from './legal'
import { marcajeOf, distance, sameCell } from './derive'
import { abilityValue } from '../ratings'
import { forDice } from '../engine/marcaje'
import { passDice, contestDice } from '../engine/dice'

/**
 * Per-difficulty behaviour. `oddsTrust` is the character knob: at 0 every gamble feels
 * 50/50, at 1 the AI reads the true dice odds. `noise` scrambles the ranking (a weak
 * player is inconsistent); `risk` scales turnover aversion; `pressure` scales how much
 * winning the ball back is worth on defence.
 */
export interface AiWeights {
  noise: number
  oddsTrust: number
  risk: number
  pressure: number
}

export const AI_WEIGHTS: Record<Difficulty, AiWeights> = {
  // easy is odds-blind and reckless (barely fears a turnover), so it chases raw upside;
  // normal reads the odds partially; hard trusts them fully and, trusting them, is
  // EV-neutral (risk 1) rather than extra-cautious — the true odds already price the
  // gamble, so piling on aversion only makes it under-shoot.
  easy: { noise: 26, oddsTrust: 0.1, risk: 0.45, pressure: 0.55 },
  normal: { noise: 12, oddsTrust: 0.6, risk: 0.9, pressure: 1.0 },
  hard: { noise: 4, oddsTrust: 1.0, risk: 1.0, pressure: 1.2 },
}

// ── Value scale (roughly 0..100, so `noise` is comparable across actions) ─────────
const GOAL = 100 // scoring is the objective
const KEEP = 18 // retaining possession via a completed action
const FWD = 8 // per cell of forward progress
const REGATE_BONUS = 10 // going on top + libre next jugada
// A lost possession costs more the closer the ball is to my own goal, because the
// opponent gains it there: cheap after a shot from their box (they restart deep), dear
// after a giveaway in my own third. `TURN_BASE + opponentProgress(lossCell) * TURN_PER`,
// so a missed shot is a low-cost turnover and a shot from the box is worth taking.
const TURN_BASE = 8
const TURN_PER = 8 // × opponent's progress at the loss cell (0..5) → 8..48
const OWN_GOAL = 110 // a failed cesión concedes — worse than any turnover
const TEMPO = 12 // losing move-order on a failed pase al hueco
const STEAL = 58 // winning the ball back
const STEAL_FAIL = 22 // a failed robo gifts the attacker a free advance
const ANTICIP_FAIL = 26 // a failed anticipación leaves the attacker libre (and may unmark)
const DECLINE_DEF = 14 // the bar a steal must clear to be worth attempting
const MOVE_BASE = 8 // an off-ball run
const MOVE_FWD = 3 // per cell an off-ball run gains
const PRESS_BASE = 6 // a defensive closing-down move
const CLOSE = 9 // per cell a press cuts the gap to the ball
const MARK_BONUS = 24 // landing on the carrier (establishes MH)
const PICKUP = 90 // reaching a loose ball
const RECOVER_BASE = 40
const KEEPER_BASE = 16

/** How far a cell is along a side's attack (higher = closer to the goal it attacks). */
function progress(side: Side, cell: Cell): number {
  return side === 'home' ? cell.row : 5 - cell.row
}

/** Cost of losing possession at `cell`: dearer the nearer it is to `me`'s own goal. */
function turnoverCost(me: Side, cell: Cell): number {
  return TURN_BASE + progress(me === 'home' ? 'away' : 'home', cell) * TURN_PER
}

function rate(p: MatchPlayer, key: AbilityKey): number {
  return abilityValue(p.card, key)
}

// ── The dice odds `scoreContest` implies (closed forms, no rolling) ───────────────

/** Ways two d6 sum to ≥ target, target 0..12 (index); ≥13 → 0. */
const GE_2D6 = [36, 36, 36, 35, 33, 30, 26, 21, 15, 10, 6, 3, 1]

/** P(two d6 + rating ≥ 10) = P(two d6 ≥ 10 − rating). */
function twoDiceProb(rating: number): number {
  const target = 10 - rating
  if (target <= 0) return 1
  if (target > 12) return 0
  return GE_2D6[target] / 36
}

/** P(one d6 + 5 + rating ≥ 10) = P(d6 ≥ 5 − rating). */
function oneDieProb(rating: number): number {
  const need = 5 - rating
  if (need <= 1) return 1
  if (need > 6) return 0
  return (7 - need) / 6
}

/** Probability a contest of `dice` dice + `rating` reaches the target (≥ 10). */
export function successProb(dice: 0 | 1 | 2, rating: number): number {
  if (dice === 0) return 1
  return dice === 1 ? oneDieProb(rating) : twoDiceProb(rating)
}

/** The acting side for any non-terminal phase. */
function actingSide(state: MatchState): Side {
  return (state.phase as { side: Side }).side
}

/**
 * Score one candidate; higher is better. `mix` blends the true probability toward 0.5 by
 * `1 − oddsTrust`, so a low-trust AI cannot distinguish a likely gamble from a long shot.
 */
function score(state: MatchState, action: Action, w: AiWeights): number {
  const me = state.phase.kind === 'fulltime' ? 'home' : actingSide(state)
  const players = state.players
  const ballCell = state.ball.cell
  const mix = (p: number): number => w.oddsTrust * p + (1 - w.oddsTrust) * 0.5

  switch (action.kind) {
    case 'shot': {
      const shooter = players[state.ball.carrier!]
      const mark = forDice(marcajeOf(state, shooter.id))
      const shotKey: AbilityKey = action.shot === 'RM' ? 'rm' : 'dl'
      const onTarget = successProb(contestDice(mark, action.shot), rate(shooter, shotKey))
      const keeper = players[keeperId(other(me))]
      const saveKey: AbilityKey = action.shot === 'RM' ? 'rf' : 'co'
      const save = twoDiceProb(rate(keeper, saveKey))
      const goalP = onTarget * (1 - save)
      // A missed/saved shot hands the opponent a keeper restart — but from deep, so the
      // turnover is cheap (the shooter is in the attacking box), which is what makes a
      // decent chance worth taking rather than over-elaborating.
      return GOAL * mix(goalP) - turnoverCost(me, shooter.cell) * mix(1 - goalP) * w.risk
    }

    case 'pass': {
      const from = players[state.ball.carrier!]
      const to = players[action.to]
      const cesion = to.id === keeperId(me)
      const forward = progress(me, to.cell) - progress(me, from.cell)
      const value = KEEP + Math.max(0, forward) * FWD
      if (action.pass === 'PD') {
        // Automatic; a back-pass to the keeper is safe but rarely productive.
        return cesion ? KEEP * 0.2 : value
      }
      const dice = passDice(forDice(marcajeOf(state, from.id)), forDice(marcajeOf(state, to.id)), action.pass)
      const ratingKey: AbilityKey = action.pass === 'PL' ? 'pl' : 'pc'
      const p = successProb(dice, rate(from, ratingKey))
      // A failed cesión is an own goal (page 11); a failed field pass loses the ball here.
      const downside = cesion ? OWN_GOAL : turnoverCost(me, from.cell)
      return value * mix(p) - downside * mix(1 - p) * w.risk
    }

    case 'hueco': {
      const from = players[state.ball.carrier!]
      const ratingKey: AbilityKey = action.pass === 'PL' ? 'pl' : 'pc'
      const p = twoDiceProb(rate(from, ratingKey)) // al hueco is always two dice
      const forward = progress(me, action.to) - progress(me, from.cell)
      const value = KEEP * 0.7 + Math.max(0, forward) * FWD
      // Failure loses move order, not possession outright — a milder cost than a turnover.
      return value * mix(p) - TEMPO * mix(1 - p) * w.risk
    }

    case 'regate': {
      const self = players[state.ball.carrier!]
      const mark = forDice(marcajeOf(state, self.id))
      const p = successProb(contestDice(mark, 'RG'), rate(self, 'rg'))
      return (KEEP + REGATE_BONUS) * mix(p) - turnoverCost(me, self.cell) * mix(1 - p) * w.risk
    }

    case 'move': {
      const mover = players[action.player]
      if (state.phase.kind === 'attack') {
        const forward = progress(me, action.to) - progress(me, mover.cell)
        if (state.ball.carrier === action.player) {
          // A libre carrier advancing keeps the ball and gains ground — a safe advance.
          return KEEP + Math.max(0, forward) * FWD
        }
        // An off-ball run: push a player up and create an outlet nearer goal.
        return MOVE_BASE + Math.max(0, forward) * MOVE_FWD + progress(me, action.to) * 0.5
      }
      // Defensive press (defend_move / hueco_move): close down the ball, ideally onto it.
      const before = distance(mover.cell, ballCell)
      const after = distance(action.to, ballCell)
      const onto = sameCell(action.to, ballCell)
      const bonus = onto ? (state.ball.carrier === null ? PICKUP : MARK_BONUS) : 0
      return PRESS_BASE + w.pressure * ((before - after) * CLOSE + bonus)
    }

    case 'anticipacion': {
      const def = players[action.defender]
      const p = twoDiceProb(rate(def, 'a'))
      return STEAL * w.pressure * mix(p) - ANTICIP_FAIL * mix(1 - p)
    }

    case 'robo': {
      const def = players[action.defender]
      const p = twoDiceProb(rate(def, 'rb'))
      return STEAL * w.pressure * mix(p) - STEAL_FAIL * mix(1 - p)
    }

    case 'decline':
      // Defensive baseline: a steal is only worth it if it clears this bar.
      return DECLINE_DEF

    case 'robo_advance': {
      const holder = players[state.ball.carrier!]
      const forward = progress(me, action.to) - progress(me, holder.cell)
      // A free advance with the ball (not a movement): strictly better than standing pat.
      return KEEP + Math.max(0, forward) * FWD + 4
    }

    case 'decline_advance':
      return KEEP - 2 // keeps the ball and stays libre, but gains no ground

    case 'recover': {
      // Take possession with the deepest, safest player.
      const p = players[action.player]
      return RECOVER_BASE - progress(me, p.cell) * 2
    }

    case 'keeper_pass': {
      const to = players[action.to]
      // The keeper restarts from his own empty cell (always SM); only the receiver's mark
      // adds dice, and the keeper's own PC/PL count as zero (page 11).
      const dice = passDice('SM', forDice(marcajeOf(state, to.id)), action.pass)
      const p = successProb(dice, 0)
      const value = KEEPER_BASE + progress(me, to.cell) * FWD
      return value * mix(p) - turnoverCost(me, to.cell) * mix(1 - p)
    }

    case 'keeper_hueco': {
      const p = twoDiceProb(0)
      const value = KEEPER_BASE * 0.6 + progress(me, action.to) * FWD
      return value * mix(p) - TEMPO * mix(1 - p)
    }

    case 'premove': {
      const mover = players[action.player]
      const forward = progress(me, action.to) - progress(me, mover.cell)
      return 4 + Math.max(0, forward) * 2
    }

    case 'premove_done':
      return 8

    case 'place':
    case 'placement_done':
      return 0
  }
}

/** Choose an action for `difficulty`'s side in the current phase. */
export function chooseAction(state: MatchState, rng: Rng, difficulty: Difficulty): Action {
  const options = legalActions(state)
  if (options.length === 0) throw new Error('AI asked to act with no legal actions')
  const w = AI_WEIGHTS[difficulty]

  let best = options[0]
  let bestScore = -Infinity
  for (const a of options) {
    const s = score(state, a, w) + rng.next() * w.noise
    if (s > bestScore) {
      bestScore = s
      best = a
    }
  }
  return best
}
