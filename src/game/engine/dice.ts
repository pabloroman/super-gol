import type { Rng } from './rng'
import type { Marcaje } from './types'

/**
 * The dice core — every contested action in Super Gol reduces to the same shape
 * (rulebook pages 6–11 and the master charts TABLA 1 & TABLA 2, page 30):
 *
 *   reach a SUM ≥ 10, from  (N dice) + (5 if N === 1) + rating
 *
 * where N depends only on the marcaje (marking):
 *   - N = 0 → automatic (a pase directo; no roll).
 *   - N = 1 → one d6 + a CONSTANT 5 + rating   (sin marcaje / marcaje en zona).
 *   - N = 2 → two d6 + rating                   (marcaje al hombre).
 *
 * The `+5` is a fixed bonus, NOT a second die (max single-die total is 6+5+X).
 * A rating the card lacks counts as 0 (page 6) — the caller passes 0.
 */

export const TARGET = 10

export type PassType = 'PD' | 'PC' | 'PL' | 'PA'
export type ContestAction = 'RG' | 'RM' | 'DL'

/** Marcaje states that roll a single die (+5). LIBRE behaves like SM here. */
function isSingleDie(mark: Marcaje): boolean {
  return mark === 'SM' || mark === 'MZ' || mark === 'LIBRE'
}

/**
 * TABLA 1 — dice a passer/receiver contributes by pass type and their own
 * marcaje. The dice actually rolled for a pass is the MAXIMUM of the passer's
 * and the receiver's counts (page 31: PC passer-SM Nº 0, receiver-MH Nº 2 →
 * «máximo entre 0 y 2 = 2»). PD is always automatic.
 */
export function diceForPass(mark: Marcaje, type: PassType): 0 | 1 | 2 {
  if (type === 'PD') return 0
  if (mark === 'MH') return 2
  // SM / MZ / LIBRE:
  if (type === 'PC') return mark === 'SM' || mark === 'LIBRE' ? 0 : 1
  // PL and PA: 1 die under SM or MZ.
  return 1
}

/** Dice actually rolled for a pass = max(passer, receiver) per TABLA 1. */
export function passDice(
  passer: Marcaje,
  receiver: Marcaje,
  type: PassType,
): 0 | 1 | 2 {
  return Math.max(diceForPass(passer, type), diceForPass(receiver, type)) as 0 | 1 | 2
}

/**
 * TABLA 2 — dice for a regate or shot by the actor's marcaje: two under marcaje
 * al hombre, one (+5) under zonal / no marking (pages 9–10).
 */
export function diceForAction(mark: Marcaje, _action: ContestAction): 1 | 2 {
  return mark === 'MH' ? 2 : 1
}

export interface Contest {
  /** The die faces rolled (empty for an automatic action). */
  dice: number[]
  /** Final sum: dice + (5 if one die) + rating. */
  total: number
  /** Whether the sum reached the target (≥ 10). */
  success: boolean
}

/**
 * Pure scoring seam: given explicit die faces and a rating, compute the contest
 * result. Tests drive this with the rulebook's worked-example rolls (no PRNG).
 * The `+5` constant is added iff exactly one die was rolled.
 */
export function scoreContest(dice: number[], rating: number): Contest {
  const bonus = dice.length === 1 ? 5 : 0
  const total = dice.reduce((s, d) => s + d, 0) + bonus + rating
  // Zero dice = automatic (pase directo): a rating-only total still "succeeds".
  const success = dice.length === 0 ? true : total >= TARGET
  return { dice, total, success }
}

/**
 * Invert `scoreContest`: recover the term-by-term breakdown of a contest from its
 * die faces and final `total`, so the UI can print the rulebook's sum
 * (e.g. «RG ! (D1: 4 + D2: 4 + 2)» or «DL ! (5 + D1: 5 + 0)») without the engine
 * having to carry the rating and bonus as separate fields. Pure and derived from
 * the same formula, so it stays correct as long as `total` is `scoreContest`'s.
 */
export function contestBreakdown(
  dice: number[],
  total: number,
): { dice: number[]; bonus: 0 | 5; rating: number; total: number; target: number } {
  const bonus: 0 | 5 = dice.length === 1 ? 5 : 0
  const diceSum = dice.reduce((s, d) => s + d, 0)
  return { dice, bonus, rating: total - diceSum - bonus, total, target: TARGET }
}

/** Roll `n` dice and score them against the target. */
export function resolveContest(rng: Rng, n: 0 | 1 | 2, rating: number): Contest {
  const dice: number[] = []
  for (let i = 0; i < n; i++) dice.push(rng.d6())
  return scoreContest(dice, rating)
}

/** Number of dice for a regate/shot given the actor's marcaje. */
export function contestDice(mark: Marcaje, action: ContestAction): 1 | 2 {
  return diceForAction(mark, action)
}

export { isSingleDie }
