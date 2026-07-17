/**
 * Board geometry and the derived-marcaje rule.
 *
 * Nothing here rolls dice or mutates state — these are the pure queries the rules
 * (`legal.ts`), the reducer (`reducer.ts`), the AI and the UI all read. The single
 * most important function is `marcajeOf`: marcaje is not a field anyone sets, it is
 * read off the stacking, exactly as the rulebook describes it (page 4).
 */

import type { Cell } from '../engine/pitch'
import { zoneAt, type Zone } from '../engine/pitch'
import type { MatchState, MatchPlayer, PlayerId, Side, Marcaje } from './state'
import { COLS, ROWS } from './state'

/** Home keeps goal below row 0, away above row 5 — outside the 30 playable squares. */
export function keeperCell(side: Side): Cell {
  return side === 'home' ? { col: 2, row: -1 } : { col: 2, row: ROWS }
}

export function isKeeperCell(cell: Cell): boolean {
  return cell.row < 0 || cell.row >= ROWS
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.col === b.col && a.row === b.row
}

export function cellKey(cell: Cell): string {
  return `${cell.col},${cell.row}`
}

/** Inside the 5×6 grid of playable cells (excludes the keeper cells). */
export function inBounds(cell: Cell): boolean {
  return cell.col >= 0 && cell.col < COLS && cell.row >= 0 && cell.row < ROWS
}

/** The 30 playable cells, row-major. Handy for "every empty cell in range" scans. */
export const ALL_CELLS: Cell[] = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: COLS }, (_, col) => ({ col, row })),
).flat()

/**
 * The (up to 8) squares adjacent to a cell. "Casillas adyacentes" in the rulebook is
 * king-move adjacency on the grid — the worked example's moves (e.g. C4→B3) include
 * diagonals — so this is the 8-neighbourhood, clamped to the playable board. Keeper
 * cells are reached only by passes, never by movement, so they are not neighbours.
 */
export function neighbours(cell: Cell): Cell[] {
  const out: Cell[] = []
  for (let dc = -1; dc <= 1; dc++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (dc === 0 && dr === 0) continue
      const next = { col: cell.col + dc, row: cell.row + dr }
      if (inBounds(next)) out.push(next)
    }
  }
  return out
}

/**
 * Chebyshev distance (king moves), the natural metric for "a 2 ó 3 casillas de
 * distancia" on a grid where a diagonal step is one move. A keeper cell is one step
 * beyond its goal-line row, so passes to/from it measure from the goal-line row.
 */
export function distance(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row))
}

export function playerAt(state: MatchState, cell: Cell): MatchPlayer[] {
  return occupants(state, cell)
}

/** The ≤2 players on a cell — always at most two, always from different sides (page 3). */
export function occupants(state: MatchState, cell: Cell): MatchPlayer[] {
  return Object.values(state.players).filter((p) => sameCell(p.cell, cell))
}

/**
 * Whether `side` may put a player on `cell`: at most two occupants, never two of the
 * same team ("en una misma casilla sólo puede haber como máximo 2 jugadores ... y
 * siempre de distintos equipos", page 3). The keeper cells only ever hold their own
 * keeper, so they are closed to everyone else.
 */
export function canOccupy(state: MatchState, cell: Cell, side: Side): boolean {
  if (isKeeperCell(cell)) return false
  const here = occupants(state, cell)
  if (here.length >= 2) return false
  if (here.some((p) => p.side === side)) return false
  return true
}

/**
 * Marcaje of a player, derived from the board (rulebook page 4):
 *   - alone in the cell            → SM (sin marcaje)
 *   - an opponent is on top of them → MH (marcaje al hombre; the defender "encima")
 *   - they are on top (opponent below) → MZ (marcaje en zona; the defender "debajo")
 * with one overlay: the LIBRE flag. A failed defensive action leaves the carrier
 * "libre de marcaje" for the next jugada even while still geometrically marked en zona
 * — "pese a estar marcado en zona, ese marcaje ha sido invalidado" — so LIBRE ≠ SM and
 * cannot be anticipated. The flag only ever attaches to a marked player; alone still
 * reads SM.
 */
export function marcajeOf(state: MatchState, id: PlayerId): Marcaje {
  const opponent = markerOf(state, id)
  if (!opponent) return 'SM'
  if (state.libre === id) return 'LIBRE'
  return opponent.onTop ? 'MH' : 'MZ'
}

/**
 * The opponent sharing a player's cell, if any. A legal cell holds at most one
 * opponent (page 3); filtering by side rather than just "not me" keeps the read
 * correct even against a malformed state and makes the intent explicit.
 */
export function markerOf(state: MatchState, id: PlayerId): MatchPlayer | null {
  const self = state.players[id]
  return occupants(state, self.cell).find((p) => p.side !== self.side) ?? null
}

/** Zone of a cell, or `null` for a keeper cell (which is no shooting zone). */
export function zoneOf(cell: Cell): Zone | null {
  if (isKeeperCell(cell)) return null
  return zoneAt(cell)
}
