/**
 * Default board arrangement, derived from squad positions (rulebook "colocación
 * inicial", pages 4–5). Each side arranges its ten outfielders in its own half "como
 * quiera"; this is a sensible auto-placement the human then adjusts by drag before
 * kickoff, and the one reused unchanged after a goal.
 *
 * The only hard requirements are the rulebook's: the keeper in the portería, everyone
 * else in their own half, at most one per cell here (stacking only arises in play),
 * and — for the kicking side — two players on adjacent centre cells to start (page 5).
 * The shape below (a 3-4-3 across the three home rows) satisfies all of that; anything
 * prettier is the drag editor's job.
 */

import type { Cell } from '../engine/pitch'
import type { EngineCard, EngineSquad } from '../engine/types'
import { isGoalkeeper } from '../ratings'
import { positionRank } from '@/ui/positions'
import type { MatchPlayer, PlayerId, Side } from './state'
import { playerId } from './state'
import { keeperCell } from './derive'

/**
 * The ten outfield cells for a side, ordered back-to-front (own goal line first). Home
 * occupies rows 0–2 and attacks up; away is the mirror in rows 3–5. The last two
 * entries of each are the adjacent centre pair the kicking side starts on.
 */
const HOME_CELLS: Cell[] = [
  { col: 0, row: 0 }, { col: 2, row: 0 }, { col: 4, row: 0 }, // back three
  { col: 0, row: 1 }, { col: 1, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, // middle four
  { col: 1, row: 2 }, { col: 2, row: 2 }, { col: 3, row: 2 }, // front three (2 & 3 adjacent)
]

const AWAY_CELLS: Cell[] = HOME_CELLS.map((c) => ({ col: c.col, row: 5 - c.row }))

/**
 * The player the kicking side puts the ball on: the centre of its front line, whose
 * neighbour (HOME_CELLS[9], one column over) is the adjacent teammate the mandatory
 * opening pase directo goes to. Outfield cell index 8 → `PlayerId` index 9.
 */
export function kickoffCarrier(side: Side): PlayerId {
  return playerId(side, 9)
}

/**
 * Place one side: keeper in the portería, ten outfielders across their own half,
 * defenders deepest. Returns players keyed by their positional `PlayerId` (index 0 =
 * keeper). Deterministic — no RNG — so a re-placement after a goal is stable.
 */
export function autoPlace(squad: EngineSquad, side: Side): Record<PlayerId, MatchPlayer> {
  const cells = side === 'home' ? HOME_CELLS : AWAY_CELLS
  // Defenders deepest: sort by position rank (DF < MF < FW), stable for ties.
  const outfield = [...squad.outfield].sort(
    (a, b) => positionRank(a.position) - positionRank(b.position),
  )

  const players: Record<PlayerId, MatchPlayer> = {}
  const keeper = squad.keeper
  players[playerId(side, 0)] = {
    id: playerId(side, 0),
    side,
    cardId: keeper.id,
    cell: keeperCell(side),
    onTop: false,
  }
  outfield.forEach((card: EngineCard, i) => {
    const id = playerId(side, i + 1)
    players[id] = { id, side, cardId: card.id, cell: cells[i], onTop: false }
  })
  return players
}

/** The keeper detector, re-exported so callers need not reach into `../ratings`. */
export { isGoalkeeper }
