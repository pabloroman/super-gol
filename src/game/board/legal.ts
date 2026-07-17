/**
 * The legal-action generator: given a state, what can the player whose `phase` it is
 * do? This is the single source of truth the UI menu, the server validation and the AI
 * all read — legality is defined here once. It is pure and total: for every non-terminal
 * phase it returns a non-empty list (an attacker can always at least move a player, so a
 * possession can never soft-lock, since the basic game has no "end my turn").
 *
 * Enumeration, not validation: each helper lists the moves that ARE legal rather than
 * checking a proposed one, so the reducer can trust membership. The one exception is
 * `placement`, whose `place` action carries a free-form arrangement validated
 * structurally in the reducer (there are too many arrangements to enumerate).
 */

import type { Cell } from '../engine/pitch'
import type { Action } from './actions'
import type { MatchState, MatchPlayer, PlayerId, Marcaje, Side } from './state'
import { playerId } from './state'
import {
  marcajeOf,
  markerOf,
  occupants,
  neighbours,
  distance,
  canOccupy,
  cellKey,
  zoneOf,
  ALL_CELLS,
} from './derive'

const isMarked = (m: Marcaje): boolean => m === 'MH' || m === 'MZ'
const isUnmarked = (m: Marcaje): boolean => m === 'SM' || m === 'LIBRE'

const other = (s: Side): Side => (s === 'home' ? 'away' : 'home')

function playersOf(state: MatchState, side: Side): MatchPlayer[] {
  return Object.values(state.players).filter((p) => p.side === side)
}

function carrier(state: MatchState): MatchPlayer {
  return state.players[state.ball.carrier!]
}

/** The keeper of a side is always index 0. */
function keeperId(side: Side): PlayerId {
  return playerId(side, 0)
}

/** Every empty playable cell within `[lo, hi]` Chebyshev steps of `from`. */
function emptyCellsInRange(state: MatchState, from: Cell, lo: number, hi: number): Cell[] {
  const out: Cell[] = []
  for (const cell of ALL_CELLS) {
    const d = distance(from, cell)
    if (d < lo || d > hi) continue
    if (occupants(state, cell).length === 0) out.push(cell)
  }
  return out
}

/** Anti-stall: this player has not already been moved to this cell (page 12). */
function moveAllowed(state: MatchState, id: PlayerId, cell: Cell): boolean {
  return !(state.antiStall.movedTo[id] ?? []).includes(cellKey(cell))
}

/** Where a player may step: adjacent cells that are empty, hold a lone opponent, or hold a teammate (a relevo). */
function movesFor(state: MatchState, p: MatchPlayer): Action[] {
  const out: Action[] = []
  for (const cell of neighbours(p.cell)) {
    const occ = occupants(state, cell)
    const hasTeammate = occ.some((o) => o.side === p.side)
    const enterable = hasTeammate /* relevo */ || canOccupy(state, cell, p.side)
    if (!enterable) continue
    if (!moveAllowed(state, p.id, cell)) continue
    out.push({ kind: 'move', player: p.id, to: cell })
  }
  return out
}

/** The attacker's jugadas from an `attack` phase. */
function attackerActions(state: MatchState): Action[] {
  const side = state.attacker
  const self = carrier(state)
  const mark = marcajeOf(state, self.id)
  const mates = playersOf(state, side).filter((p) => p.id !== self.id)
  const out: Action[] = []

  for (const t of mates) {
    const d = distance(self.cell, t.cell)
    const tMark = marcajeOf(state, t.id)
    // Pase directo: to an adjacent unmarked teammate, no repeats in the PD run (page 6/12).
    if (d === 1 && isUnmarked(tMark) && !state.antiStall.pdChain.includes(t.id)) {
      out.push({ kind: 'pass', pass: 'PD', to: t.id })
    }
    // Pase corto: adjacent, meaningful only when a mark is involved (else it's a PD).
    if (d === 1 && (isMarked(mark) || isMarked(tMark))) {
      out.push({ kind: 'pass', pass: 'PC', to: t.id })
    }
    // Pase largo: 2–3 cells to an unmarked teammate (page 7).
    if (d >= 2 && d <= 3 && isUnmarked(tMark)) {
      out.push({ kind: 'pass', pass: 'PL', to: t.id })
    }
  }

  // Cesión: a back-pass to one's own keeper (PD/PC adjacent, PL at 2–3). A failed PC/PL
  // cesión is an own goal (page 11), but that is the reducer's business, not legality.
  const keeper = state.players[keeperId(side)]
  const dk = distance(self.cell, keeper.cell)
  if (dk === 1) {
    out.push({ kind: 'pass', pass: 'PD', to: keeper.id })
    if (isMarked(mark)) out.push({ kind: 'pass', pass: 'PC', to: keeper.id })
  } else if (dk >= 2 && dk <= 3) {
    out.push({ kind: 'pass', pass: 'PL', to: keeper.id })
  }

  // Pases al hueco: always to an empty cell, at the pass's distance (pages 7–8).
  for (const cell of emptyCellsInRange(state, self.cell, 1, 1)) {
    out.push({ kind: 'hueco', pass: 'PC', to: cell })
  }
  for (const cell of emptyCellsInRange(state, self.cell, 2, 3)) {
    out.push({ kind: 'hueco', pass: 'PL', to: cell })
  }

  // Regate: only when marked (page 9).
  if (isMarked(mark)) out.push({ kind: 'regate' })

  // Shots: from the RM box / DL ring, but only at the ATTACKING end — the zone map is
  // symmetric, so a carrier standing in their OWN ring must not be allowed to shoot at
  // the far goal (page 10: you chutar a gol from the box/ring in front of it).
  const zone = zoneOf(self.cell)
  const rmRow = side === 'home' ? 5 : 0
  const dlRow = side === 'home' ? 4 : 1
  if (zone === 'RM' && self.cell.row === rmRow) out.push({ kind: 'shot', shot: 'RM' })
  if (zone === 'DL' && self.cell.row === dlRow) out.push({ kind: 'shot', shot: 'DL' })

  // Movement: the carrier only if libre de marcaje; teammates freely; adjacency + anti-stall.
  for (const p of playersOf(state, side)) {
    if (p.id === self.id && isMarked(mark)) continue // carrier can't move when marked
    if (p.id === keeperId(side)) continue // the keeper doesn't roam in the basic game
    out.push(...movesFor(state, p))
  }

  return out
}

/**
 * The defender's options in the move window an attacker movement grants (page 5): move
 * any one player, or decline. If a defender can reach the ball holder, that move can
 * instead be a robo (case 2 — mark then rob); if a defender already marks the holder al
 * hombre, they may renounce the move to rob (case 3, page 9).
 */
function defenderMoveActions(state: MatchState): Action[] {
  const def = other(state.attacker)
  const holder = carrier(state)
  const out: Action[] = [{ kind: 'decline' }]

  for (const p of playersOf(state, def)) {
    if (p.id === keeperId(def)) continue
    for (const move of movesFor(state, p)) {
      if (move.kind !== 'move') continue
      out.push(move)
    }
  }
  // Robo case 2 (page 9): a defender who, being able to move, marks the holder al hombre
  // and robs — either by stepping onto the holder's cell from a neighbour, or (already
  // sharing the cell en zona, below the holder) by flipping on top in place.
  const marker = markerOf(state, holder.id)
  for (const p of playersOf(state, def)) {
    if (p.id === keeperId(def)) continue
    if (distance(p.cell, holder.cell) === 1 && canOccupy(state, holder.cell, def)) {
      out.push({ kind: 'robo', defender: p.id, mode: 'move-onto', to: { ...holder.cell } })
    }
  }
  if (marker && !marker.onTop) {
    // Sharing the holder's cell but en zona (below): flip on top and rob.
    out.push({ kind: 'robo', defender: marker.id, mode: 'move-onto', to: { ...holder.cell } })
  }
  // Case 3: already al hombre on the holder — renounce the move and rob in place.
  if (marker && marker.onTop) {
    out.push({ kind: 'robo', defender: marker.id, mode: 'renounce' })
  }
  return out
}

export function legalActions(state: MatchState): Action[] {
  const phase = state.phase
  switch (phase.kind) {
    case 'placement':
      // `place` is free-form (validated structurally in the reducer); only the commit
      // is enumerable here.
      return [{ kind: 'placement_done' }]

    case 'kickoff': {
      // The mandatory opening pase directo to an adjacent teammate (page 12).
      const self = carrier(state)
      return playersOf(state, phase.side)
        .filter((p) => p.id !== self.id && distance(p.cell, self.cell) === 1)
        .map((p) => ({ kind: 'pass', pass: 'PD', to: p.id }))
    }

    case 'attack':
      return attackerActions(state)

    case 'defend_move':
      return defenderMoveActions(state)

    case 'defend_interrupt': {
      // After a completed PC/PL to a marked receiver: anticipación (only if the marker
      // is en zona), robo (only if al hombre), or decline (pages 8–9).
      const receiverMark = marcajeOf(state, phase.receiver)
      const out: Action[] = [{ kind: 'decline' }]
      const marker = markerOf(state, phase.receiver)
      if (marker) {
        if (receiverMark === 'MZ') out.push({ kind: 'anticipacion', defender: marker.id })
        if (receiverMark === 'MH') out.push({ kind: 'robo', defender: marker.id, mode: 'after-pass' })
      }
      return out
    }

    case 'robo_advance': {
      // A failed robo lets the attacker advance one cell with the ball, or decline (page 9).
      const self = carrier(state)
      const out: Action[] = [{ kind: 'decline_advance' }]
      for (const cell of neighbours(self.cell)) {
        if (canOccupy(state, cell, self.side) || occupants(state, cell).some((o) => o.side !== self.side)) {
          out.push({ kind: 'robo_advance', to: cell })
        }
      }
      return out
    }

    case 'recovery_pick':
      // A failed PC/PL with several equal recoverers: the defender chooses one (page 7).
      return phase.candidates.map((id) => ({ kind: 'recover', player: id }))

    case 'hueco_move': {
      // The side that won (or lost) the al-hueco roll moves one player toward the loose
      // ball first (pages 7–8). Any legal movement, plus decline.
      const out: Action[] = [{ kind: 'decline' }]
      for (const p of playersOf(state, phase.side)) {
        if (p.id === keeperId(phase.side)) continue
        out.push(...movesFor(state, p))
      }
      return out
    }

    case 'restart_move': {
      // One player per side may reposition before the keeper restarts (page 11).
      const out: Action[] = [{ kind: 'premove_done' }]
      for (const p of playersOf(state, phase.side)) {
        if (p.id === keeperId(phase.side)) continue
        out.push(...movesFor(state, p).map((m) => ({ ...m, kind: 'premove' }) as Action))
      }
      return out
    }

    case 'keeper_restart': {
      // The keeper puts the ball back in play; his PC/PL count as zero, distance +1
      // allowed, so PD/PC reach 1–2 cells and PL 3–4 (page 11).
      const keeper = state.players[keeperId(phase.side)]
      const out: Action[] = []
      for (const t of playersOf(state, phase.side)) {
        if (t.id === keeper.id) continue
        const d = distance(keeper.cell, t.cell)
        const tMark = marcajeOf(state, t.id)
        if (d <= 2 && isUnmarked(tMark)) out.push({ kind: 'keeper_pass', pass: 'PD', to: t.id })
        if (d <= 2) out.push({ kind: 'keeper_pass', pass: 'PC', to: t.id })
        if (d >= 3 && d <= 4 && isUnmarked(tMark)) out.push({ kind: 'keeper_pass', pass: 'PL', to: t.id })
      }
      for (const cell of emptyCellsInRange(state, keeper.cell, 1, 2)) {
        out.push({ kind: 'keeper_hueco', pass: 'PC', to: cell })
      }
      for (const cell of emptyCellsInRange(state, keeper.cell, 3, 4)) {
        out.push({ kind: 'keeper_hueco', pass: 'PL', to: cell })
      }
      return out
    }

    case 'fulltime':
      return []
  }
}

export { isMarked, isUnmarked, other, playersOf, carrier, keeperId, moveAllowed }
