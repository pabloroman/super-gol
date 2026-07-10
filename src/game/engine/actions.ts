import type { Rng } from './rng'
import {
  resolveContest,
  passDice,
  contestDice,
  type Contest,
  type PassType,
} from './dice'
import { forDice } from './marcaje'
import type { Marcaje } from './types'

/**
 * Attacker action resolvers. These are thin, pure wrappers over the dice core:
 * each computes the Contest for one jugada. The loop owns the state machine
 * (marcaje transitions, ball movement, possession) — keeping these functions
 * side-effect free makes them exhaustively testable.
 */

/** Pase corto (PC) or pase largo (PL) to a teammate; dice = max(passer, receiver). */
export function resolvePase(
  rng: Rng,
  type: Extract<PassType, 'PC' | 'PL'>,
  passerMark: Marcaje,
  receiverMark: Marcaje,
  rating: number,
): Contest {
  const n = passDice(forDice(passerMark), forDice(receiverMark), type)
  return resolveContest(rng, n, rating)
}

/** Pase al hueco (corto or largo): ALWAYS two dice, no marcaje bonus (pages 7–8). */
export function resolvePaseHueco(rng: Rng, rating: number): Contest {
  return resolveContest(rng, 2, rating)
}

/** Regate: 2 dice under marcaje al hombre, else 1 die + 5 (pages 9–10). */
export function resolveRegate(rng: Rng, mark: Marcaje, rg: number): Contest {
  return resolveContest(rng, contestDice(forDice(mark), 'RG'), rg)
}

/** Remate en el área (RM) or disparo lejano (DL); same dice rule as regate. */
export function resolveShot(
  rng: Rng,
  action: 'RM' | 'DL',
  mark: Marcaje,
  rating: number,
): Contest {
  return resolveContest(rng, contestDice(forDice(mark), action), rating)
}
