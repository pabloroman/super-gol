/**
 * Real 5×6 board model.
 *
 * The field is 30 casillas (5 columns × 6 rows) plus two goalkeeper cells, with the
 * special zones RM (remate cercano / box), DL (disparo lejano) and PA (pases altos /
 * wings) from rulebook page 1 (docs/rulebook/pages/page-01.md, verified against the
 * rotated scan and the coordinate system fixed on page 17: columns A–E → 0–4, rows
 * 1–6 → 0–5). Cells that are none of those are plain build-up squares, tagged MID.
 *
 * Absolute coordinates: home defends row 0, away defends row 5; each side attacks
 * toward the opponent's goal ("se ataca hacia arriba", page 2). The zone map is
 * symmetric top/bottom, so an RM/DL box exists at each end. Everything stays behind
 * the `Pitch` interface: the loop only advances the carrier and asks whether a shot
 * is legal, so swapping the old abstract "advancement band" for real cells changed
 * no dice/marcaje math and leaves outcomes deterministic.
 */

import type { Side } from './types'

export const COLS = 5
export const ROWS = 6

export type Zone = 'RM' | 'DL' | 'PA' | 'MID'

/** A square on the board, in absolute coordinates (col 0–4, row 0–5). */
export interface Cell {
  col: number
  row: number
}

/**
 * Zone of every cell, indexed `[row][col]` in absolute coordinates (row 0 = home
 * goal line, row 5 = away goal line). Straight from the revised page-1 diagram: the
 * box (RM) is the three central cells at each goal line, the DL ring is the three
 * central cells just outside it, the two centre rows are midfield build-up, and the
 * wings are PA.
 *
 * Single-valued simplification: page 1 labels the DL ring `PA | PA+DL | DL | PA+DL |
 * PA` — cols 1 and 3 carry *both* the pase-alto and long-shot labels. The basic game
 * only cares about RM/DL shot-legality (PA is an advanced pass), so those cells are
 * tagged DL here; encode the PA+DL overlap when the advanced game lands.
 */
export const ZONE_MAP: Zone[][] = [
  ['PA', 'RM', 'RM', 'RM', 'PA'], // row 0 — home's own box (away's target)
  ['PA', 'DL', 'DL', 'DL', 'PA'], // row 1 — DL ring
  ['MID', 'MID', 'MID', 'MID', 'MID'], // row 2 — midfield build-up
  ['MID', 'MID', 'MID', 'MID', 'MID'], // row 3 — midfield build-up
  ['PA', 'DL', 'DL', 'DL', 'PA'], // row 4 — DL ring
  ['PA', 'RM', 'RM', 'RM', 'PA'], // row 5 — away's box (home's target)
]

export function zoneAt(cell: Cell): Zone {
  return ZONE_MAP[cell.row][cell.col]
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export interface Pitch {
  /** The carrier's square, in absolute board coordinates. */
  readonly cell: Cell
  /** The zone the carrier currently stands in. */
  readonly zone: Zone
  /** The side this pitch's advancement is oriented for. */
  readonly attacker: Side
  /** RM shots are legal from the box only. */
  canShootRM(): boolean
  /** Long shots are legal from the DL ring only. */
  canShootDL(): boolean
  /** Advance (+1) or retreat (−1) one row toward/away the attacking goal, clamped. */
  step(dir: 1 | -1): Pitch
  /** Shift the carrier to a given lane (a completed pass); returns a new Pitch. */
  toLane(col: number): Pitch
  /** Rows still to reach the RM line (0 when already in the box). */
  toGoal(): number
}

function makePitch(cell: Cell, attacker: Side): Pitch {
  const dir = attacker === 'home' ? 1 : -1 // toward the attacking goal
  const goalRow = attacker === 'home' ? ROWS - 1 : 0
  const zone = zoneAt(cell)
  return {
    cell,
    zone,
    attacker,
    canShootRM: () => zone === 'RM',
    canShootDL: () => zone === 'DL',
    step: (d) =>
      makePitch({ col: cell.col, row: clamp(cell.row + dir * d, 0, ROWS - 1) }, attacker),
    toLane: (col) => makePitch({ col: clamp(col, 0, COLS - 1), row: cell.row }, attacker),
    toGoal: () => Math.abs(goalRow - cell.row),
  }
}

/** The interior lane (cols 1–3) the carrier occupies at a given depth. */
const CENTRE_LANE = 2

/**
 * Kickoff / post-goal restart: the ball sits at midfield, in the centre lane, on the
 * attacker's own side of the halfway line (home row 2, away row 3). Every possession
 * starts here — the basic-game engine models each attack as a build-up from the
 * halfway line — so advancing crosses a midfield row, then the DL ring, then the box.
 */
export function initialPitch(attacker: Side): Pitch {
  const startRow = attacker === 'home' ? 2 : 3
  return makePitch({ col: CENTRE_LANE, row: startRow }, attacker)
}

export function pitchAt(cell: Cell, attacker: Side): Pitch {
  return makePitch(cell, attacker)
}

/**
 * A stable interior lane (cols 1–3) for a receiver, so passes shift the ball across
 * the pitch for the visual replay without ever touching a wing (which would change
 * the zone and thus shot legality). Deterministic — no RNG — so match outcomes stay
 * byte-identical to the pre-grid engine.
 */
export function laneFor(index: number): number {
  return 1 + (((index % 3) + 3) % 3)
}
