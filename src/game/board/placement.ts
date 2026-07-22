/**
 * Default board arrangement, derived from each squad's real demarcación (rulebook
 * "colocación inicial", pages 4–5). Every side lines up in its own half with its defenders
 * on the line closest to its keeper, midfielders on the next line and forwards ahead —
 * each line spread evenly across the pitch. Deterministic (no RNG), so the re-placement
 * after a goal is stable and identical for the same squad.
 *
 * The pitch is five columns wide, so a line holds at most five players. That ceiling is
 * enforced up front at squad selection (`src/game/squad.ts` + the `save_squad` RPC), and
 * every AI formation obeys it too — so every squad reaching here already fits: one
 * demarcación group, one line, no overflow to absorb.
 *
 * The hard rulebook requirements this satisfies: the keeper in the portería, everyone
 * else in their own half, at most one per cell (stacking only arises in play), and — for
 * the kicking side — a starter with an adjacent teammate for the opening pase directo
 * (page 5), guaranteed because a valid squad always has a forward backed by the midfield
 * line (see `kickoffCarrier`).
 */

import type { EngineCard, EngineSquad } from '../engine/types'
import { isGoalkeeper } from '../ratings'
import type { MatchPlayer, PlayerId, Side } from './state'
import { playerId } from './state'
import { keeperCell, isKeeperCell } from './derive'

/**
 * The outfield line a player stands on, back-to-front: defenders deepest (0), midfielders
 * (1), forwards ahead (2). `GK` here can only be a stray keeper-rated outfielder (the real
 * keeper is placed separately) and sits deepest; an unknown/absent position falls to
 * midfield. `cards.position` stores the catalog's GK/DF/MF/FW group codes.
 */
function lineOf(position: string | null): 0 | 1 | 2 {
  switch (position) {
    case 'FW':
      return 2
    case 'MF':
      return 1
    case 'DF':
    case 'GK':
      return 0
    default:
      return 1
  }
}

/**
 * Which of the five columns a line of `n` players fills — centred and evenly spread,
 * symmetric about the middle column. Indexed by line size (0..5, the board being five
 * wide): 3 → the wings and the middle, 4 → a gap at centre, 5 → the full row.
 */
const COLUMNS_BY_COUNT: readonly (readonly number[])[] = [
  [],
  [2],
  [1, 3],
  [0, 2, 4],
  [0, 1, 3, 4],
  [0, 1, 2, 3, 4],
]

/** The three line rows for a side, back-to-front: home fills 0→2 (0 by its keeper), away 5→3. */
function lineRows(side: Side): readonly [number, number, number] {
  return side === 'home' ? [0, 1, 2] : [5, 4, 3]
}

/**
 * Place one side: keeper in the portería, ten outfielders across their own half by
 * demarcación. Returns players keyed by their positional `PlayerId` (index 0 = keeper,
 * then back-to-front). Deterministic — no RNG — so a re-placement after a goal is stable.
 */
export function autoPlace(squad: EngineSquad, side: Side): Record<PlayerId, MatchPlayer> {
  const players: Record<PlayerId, MatchPlayer> = {}
  players[playerId(side, 0)] = {
    id: playerId(side, 0),
    side,
    card: squad.keeper,
    cell: keeperCell(side),
    onTop: false,
  }

  // Bucket the ten outfielders into their demarcación lines, input order preserved.
  const lines: [EngineCard[], EngineCard[], EngineCard[]] = [[], [], []]
  for (const card of squad.outfield) lines[lineOf(card.position)].push(card)

  // Lay each line out on its row, evenly across the columns, ids running keeper→forwards.
  const rows = lineRows(side)
  let index = 1
  lines.forEach((members, line) => {
    const cols = COLUMNS_BY_COUNT[members.length]
    members.forEach((card: EngineCard, i) => {
      const id = playerId(side, index++)
      players[id] = { id, side, card, cell: { col: cols[i], row: rows[line] }, onTop: false }
    })
  })
  return players
}

/**
 * The player the kicking side puts the ball on: its front-most, most central outfielder,
 * whose neighbour (a same-line teammate or the midfield line one row back) receives the
 * mandatory opening pase directo. Derived from the placed players so it tracks whatever
 * formation `autoPlace` produced. A valid squad always has a forward backed by the
 * midfield line, so this player always has a teammate at Chebyshev distance 1.
 */
export function kickoffCarrier(players: Record<PlayerId, MatchPlayer>, side: Side): PlayerId {
  const outfield = Object.values(players).filter(
    (p) => p.side === side && !isKeeperCell(p.cell),
  )
  // The front-most occupied row: highest for home (attacking up), lowest for away.
  const frontRow = outfield.reduce(
    (best, p) => (side === 'home' ? Math.max(best, p.cell.row) : Math.min(best, p.cell.row)),
    side === 'home' ? -Infinity : Infinity,
  )
  // Nearest the centre column, tie-broken deterministically by column then id.
  const front = outfield
    .filter((p) => p.cell.row === frontRow)
    .sort(
      (a, b) => Math.abs(a.cell.col - 2) - Math.abs(b.cell.col - 2) || a.id.localeCompare(b.id),
    )
  return front[0].id
}

/** The keeper detector, re-exported so callers need not reach into `../ratings`. */
export { isGoalkeeper }
