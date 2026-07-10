import type { Rng } from './rng'
import { resolveContest, type Contest } from './dice'

/**
 * Goalkeeper saves (rulebook page 11). Once a shot is on target the keeper rolls
 * two dice plus the relevant rating and saves on 10, 11 or 12:
 *   - Reflejos (RF) against a remate en el área (RM).
 *   - Colocación (CO) against a disparo lejano (DL).
 * The keeper always rolls two dice — there is no single-die case for a save.
 */
export function resolveSave(rng: Rng, stat: number): { contest: Contest; saved: boolean } {
  const contest = resolveContest(rng, 2, stat)
  return { contest, saved: contest.success }
}

/** A goal requires the shot to be on target AND the keeper to fail the save. */
export function isGoal(shotSuccess: boolean, saved: boolean): boolean {
  return shotSuccess && !saved
}
