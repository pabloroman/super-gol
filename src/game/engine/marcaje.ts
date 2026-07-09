import type { Marcaje } from './types'

/**
 * Marcaje (marking) transitions — the trickiest correctness surface of the basic
 * game. Each function encodes exactly one rulebook outcome and cites its page.
 * `carrier` is the marcaje of whichever player will hold the ball afterwards.
 */

export interface MarcajeOutcome {
  /** Who ends up with the ball. */
  possession: 'attacker' | 'defender'
  /** The ball carrier's marcaje for the NEXT jugada. */
  carrier: Marcaje
}

/**
 * A completed pase corto/largo does not change the existing marks (pages 6–7):
 * «los marcajes existentes no variarán». The receiver keeps whatever marcaje it
 * already had.
 */
export function afterPassCompleted(receiverMark: Marcaje): MarcajeOutcome {
  return { possession: 'attacker', carrier: receiverMark }
}

/**
 * Anticipación by a zonal defender, immediately after a completed short/long
 * pass (page 8):
 * - success → defender takes the ball; the new carrier is libre de marcaje.
 * - failure → if he was man-marking he drops to zona; either way the attacker is
 *   «libre de todo marcaje» for the next jugada.
 */
export function afterAnticipacion(success: boolean): MarcajeOutcome {
  if (success) return { possession: 'defender', carrier: 'LIBRE' }
  return { possession: 'attacker', carrier: 'LIBRE' }
}

/**
 * Robo de balón by a man-marking defender (page 9):
 * - success → defender takes the ball, always marking al hombre.
 * - failure → the attacker may advance one cell (a free move that is not a
 *   "movement"); if he declines, the defender drops to zona and the carrier is
 *   libre for the next jugada. We model the carrier as libre either way, since
 *   the failed robo has broken the man-mark.
 */
export function afterRobo(success: boolean): MarcajeOutcome {
  if (success) return { possession: 'defender', carrier: 'MH' }
  return { possession: 'attacker', carrier: 'LIBRE' }
}

/**
 * Regate by the ball carrier (pages 9–10):
 * - success → the carrier goes «encima» (marks the defender al hombre) and is
 *   libre de marcaje for the next jugada.
 * - failure → the carrier drops to a zonal mark on the defender; both are libre
 *   for the next jugada. Either way possession stays with the attacker.
 */
export function afterRegate(success: boolean): MarcajeOutcome {
  return { possession: 'attacker', carrier: success ? 'LIBRE' : 'MZ' }
}

/** LIBRE rolls like SM (one die + 5); expose the collapse for callers. */
export function forDice(mark: Marcaje): Marcaje {
  return mark === 'LIBRE' ? 'SM' : mark
}
