import type { Rng } from './rng'
import type { EngineCard, Marcaje, Difficulty } from './types'
import type { Pitch } from './pitch'
import { abilityValue } from '@/game/ratings'

/**
 * Heuristic managers. Deliberately weighted choices, not a search: the goal is a
 * plausible, rule-legal flow, with difficulty tuning three scalars — attacker
 * finishing bias, defender pressing, and defender interruption aggression.
 */

export type AttackChoice =
  | { kind: 'pase'; type: 'PC' | 'PL' }
  | { kind: 'hueco'; type: 'PC' | 'PL' }
  | { kind: 'regate' }
  | { kind: 'shot'; action: 'RM' | 'DL' }
  | { kind: 'advance' }

interface Tuning {
  /** How eagerly the attacker shoots vs. builds up. */
  finishing: number
  /** Probability the defender tightens the mark after a move. */
  press: number
  /** Probability the defender attempts an anticipación/robo when legal. */
  interrupt: number
}

const TUNING: Record<Difficulty, Tuning> = {
  easy: { finishing: 0.45, press: 0.35, interrupt: 0.45 },
  normal: { finishing: 0.55, press: 0.55, interrupt: 0.6 },
  hard: { finishing: 0.6, press: 0.75, interrupt: 0.78 },
}

export function tuning(difficulty: Difficulty): Tuning {
  return TUNING[difficulty]
}

function marked(mark: Marcaje): boolean {
  return mark === 'MH' || mark === 'MZ'
}

/** The attacker's next jugada given the ball's cell/zone and the carrier's marcaje. */
export function chooseAttack(
  rng: Rng,
  pitch: Pitch,
  mark: Marcaje,
  carrier: EngineCard,
  difficulty: Difficulty,
): AttackChoice {
  const t = tuning(difficulty)
  const dl = abilityValue(carrier, 'dl')
  const rg = abilityValue(carrier, 'rg')

  // In the box: shoot, unless man-marked and a dribble looks worthwhile first.
  if (pitch.canShootRM()) {
    if (mark === 'MH' && rng.chance(0.35 + rg * 0.08)) return { kind: 'regate' }
    return { kind: 'shot', action: 'RM' }
  }

  // From the long-shot ring: weigh a shot against working closer.
  if (pitch.canShootDL()) {
    const shootWeight = t.finishing + dl * 0.1
    if (mark === 'MH' && rng.chance(0.3 + rg * 0.08)) return { kind: 'regate' }
    if (rng.chance(Math.min(0.85, shootWeight))) return { kind: 'shot', action: 'DL' }
    // Otherwise push into the box.
    return advanceChoice(rng, mark, carrier)
  }

  // Build-up (midfield / wings): dribble out of a man-mark, else pass/advance.
  if (mark === 'MH' && rng.chance(0.3 + rg * 0.08)) return { kind: 'regate' }
  return advanceChoice(rng, mark, carrier)
}

/** Choose how to move the ball forward one band: a pass or a plain advance. */
function advanceChoice(rng: Rng, mark: Marcaje, carrier: EngineCard): AttackChoice {
  const pc = abilityValue(carrier, 'pc')
  const pl = abilityValue(carrier, 'pl')
  // Occasionally thread it into space (al hueco) when marked.
  if (marked(mark) && rng.chance(0.2)) {
    return { kind: 'hueco', type: pl >= pc ? 'PL' : 'PC' }
  }
  // Prefer the stronger pass; fall back to a plain move if both are weak.
  if (pc === 0 && pl === 0) return { kind: 'advance' }
  return { kind: 'pase', type: pl > pc ? 'PL' : 'PC' }
}

/** After an attacker move, decide the carrier's new marcaje (pressing). */
export function pressAfterMove(
  rng: Rng,
  current: Marcaje,
  difficulty: Difficulty,
): Marcaje {
  const t = tuning(difficulty)
  if (!rng.chance(t.press)) return current === 'LIBRE' ? 'SM' : current
  // Tighten one notch: SM/LIBRE → MZ, MZ → MH, MH stays.
  if (current === 'MH') return 'MH'
  if (current === 'MZ') return 'MH'
  return 'MZ'
}

/**
 * After a completed pass to a marked receiver, decide whether the defender
 * attempts an interruption. Only a zonal receiver can be anticipated and only a
 * man-marked receiver can be robbed (rulebook pages 8–9).
 */
export function chooseInterrupt(
  rng: Rng,
  receiverMark: Marcaje,
  difficulty: Difficulty,
): 'anticipacion' | 'robo' | 'none' {
  const t = tuning(difficulty)
  if (receiverMark === 'MZ') return rng.chance(t.interrupt) ? 'anticipacion' : 'none'
  if (receiverMark === 'MH') return rng.chance(t.interrupt) ? 'robo' : 'none'
  return 'none'
}
