/**
 * Real 6×5 board model.
 *
 * The field is 30 casillas (6 columns × 5 rows) plus two goalkeeper cells, with the
 * special zones RM (remate cercano / box), DL (disparo lejano) and PA (pases altos /
 * wings) from rulebook page 1 (docs/rulebook/pages/page-01.md, verified against
 * scans/page-01.jpeg). Cells that are none of those are plain build-up squares,
 * tagged MID here.
 *
 * Absolute coordinates: home defends row 0, away defends row 4; each side attacks
 * toward the opponent's goal ("se ataca hacia arriba", page 2). The zone map is
 * symmetric top/bottom, so an RM/DL box exists at each end. Everything stays behind
 * the `Pitch` interface: the loop only advances the carrier and asks whether a shot
 * is legal, so swapping the old abstract "advancement band" for real cells changed
 * no dice/marcaje math and leaves outcomes deterministic.
 */

import type { Side } from './types'

export const COLS = 6
export const ROWS = 5

export type Zone = 'RM' | 'DL' | 'PA' | 'MID'

/** A square on the board, in absolute coordinates (col 0–5, row 0–4). */
export interface Cell {
  col: number
  row: number
}

/**
 * Zone of every cell, indexed `[row][col]` in absolute coordinates (row 0 = home
 * goal line, row 4 = away goal line). This refines the *approximate* ASCII diagram
 * in page-01.md toward the rulebook's stated zone meanings — RM is the box at each
 * goal, DL is the ring just outside it, the centre row is midfield build-up, and the
 * two wings are PA — and is the single place to correct if the scan is re-verified
 * (see docs/rulebook/scans/page-01.jpeg and VERIFICATION.md).
 */
export const ZONE_MAP: Zone[][] = [
  ['PA', 'RM', 'RM', 'RM', 'RM', 'PA'], // row 0 — home's own box
  ['PA', 'DL', 'DL', 'DL', 'DL', 'PA'], // row 1
  ['PA', 'MID', 'MID', 'MID', 'MID', 'PA'], // row 2 — midfield
  ['PA', 'DL', 'DL', 'DL', 'DL', 'PA'], // row 3
  ['PA', 'RM', 'RM', 'RM', 'RM', 'PA'], // row 4 — away's box (home's target)
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

/** The interior lane (cols 1–4) the carrier occupies at a given depth. */
const CENTRE_LANE = 2

/**
 * Kickoff / post-goal restart: the ball sits at midfield, in a central lane. Every
 * possession starts here — the basic-game engine models each attack as a build-up
 * from the halfway line — so `step(1)` twice reaches the DL ring then the box.
 */
export function initialPitch(attacker: Side): Pitch {
  return makePitch({ col: CENTRE_LANE, row: 2 }, attacker)
}

export function pitchAt(cell: Cell, attacker: Side): Pitch {
  return makePitch(cell, attacker)
}

/**
 * A stable interior lane (cols 1–4) for a receiver, so passes shift the ball across
 * the pitch for the visual replay without ever touching a wing (which would change
 * the zone and thus shot legality). Deterministic — no RNG — so match outcomes stay
 * byte-identical to the pre-grid engine.
 */
export function laneFor(index: number): number {
  return 1 + (((index % 4) + 4) % 4)
}
