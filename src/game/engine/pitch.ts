/**
 * Abstracted positional model (v1).
 *
 * The full game is played on a 6×5 grid of casillas, but for the basic-game
 * engine what matters for OUTCOMES is only how far the ball has advanced toward
 * the opponent's goal — which determines whether a shot is even legal. So v1
 * tracks a single "advancement band" instead of 22 piece coordinates. Adjacency,
 * exact cells, the PA zone and relevos are intentionally not modeled.
 *
 * Everything is kept behind the `Pitch` interface so a future `Pitch2D` (a real
 * 6×5 board, for a visual replay) can drop in without touching dice/actions/loop.
 */

/** How far the ball carrier has advanced toward the opponent's goal. */
export type Band = 'OWN' | 'MID' | 'DL' | 'RM'

const ORDER: Band[] = ['OWN', 'MID', 'DL', 'RM']

export interface Pitch {
  readonly band: Band
  /** RM shots are legal from the box only. */
  canShootRM(): boolean
  /** Long shots are legal from DL range (or closer). */
  canShootDL(): boolean
  /** Advance (+1) or retreat (−1) one band, clamped; returns a new Pitch. */
  step(dir: 1 | -1): Pitch
  /** Distance in bands still to reach RM (0 when already there). */
  toGoal(): number
}

function makePitch(band: Band): Pitch {
  const idx = ORDER.indexOf(band)
  return {
    band,
    canShootRM: () => band === 'RM',
    canShootDL: () => band === 'DL' || band === 'RM',
    step: (dir) => makePitch(ORDER[Math.max(0, Math.min(ORDER.length - 1, idx + dir))]),
    toGoal: () => ORDER.length - 1 - idx,
  }
}

/** Kickoff / post-goal restart: the ball sits at midfield. */
export function initialPitch(): Pitch {
  return makePitch('MID')
}

export function pitchAt(band: Band): Pitch {
  return makePitch(band)
}
