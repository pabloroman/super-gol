import type { Rng } from './rng'
import { resolveContest, type Contest } from './dice'

/**
 * Defender interruptions after a completed pass (rulebook pages 8–9). Both roll
 * two dice plus the defender's rating:
 *   - Anticipación (A): only a defender marking the receiver EN ZONA.
 *   - Robo de balón (RB): only a defender marking the receiver AL HOMBRE.
 * The loop enforces which one is legal from the receiver's marcaje.
 */

export function resolveAnticipacion(rng: Rng, a: number): Contest {
  return resolveContest(rng, 2, a)
}

export function resolveRobo(rng: Rng, rb: number): Contest {
  return resolveContest(rng, 2, rb)
}
