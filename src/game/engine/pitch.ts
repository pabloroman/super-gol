/**
 * Real 5×6 board geometry.
 *
 * The field is 30 casillas (5 columns × 6 rows) plus two goalkeeper cells, with the
 * special zones RM (remate cercano / box), DL (disparo lejano) and PA (pases altos /
 * wings) from rulebook page 1 (docs/rulebook/pages/page-01.md, verified against the
 * rotated scan and the coordinate system fixed on page 17: columns A–E → 0–4, rows
 * 1–6 → 0–5). Cells that are none of those are plain build-up squares, tagged MID.
 *
 * Absolute coordinates: home defends row 0, away defends row 5; each side attacks
 * toward the opponent's goal ("se ataca hacia arriba", page 2). The zone map is
 * symmetric top/bottom, so an RM/DL box exists at each end.
 *
 * This module is now just the static board geometry — the coordinate system, the zone
 * map and `zoneAt` — read by the board engine (`src/game/board/`) and the pitch UI.
 * The old carrier-only `Pitch` closure that the retired one-shot simulation advanced
 * is gone; the board engine tracks all 22 players by absolute `Cell` instead.
 */

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
