import { describe, it, expect } from 'vitest'
import type { EngineCard, EngineSquad } from '@/game/engine/types'
import {
  createMatch,
  marcajeOf,
  occupants,
  canOccupy,
  neighbours,
  distance,
  keeperCell,
  isKeeperCell,
  playerId,
  type MatchState,
  type Side,
} from '@/game/board'

/** A card carrying only the ratings a test needs; the rest default to 0 (page 6). */
function card(id: string, position: string, abilities: EngineCard['abilities'] = {}): EngineCard {
  return { id, name: id, position, abilities }
}

/** A full 11-card squad: one keeper + ten outfielders across DF/MF/FW. */
function squad(prefix: string): EngineSquad {
  const outfield: EngineCard[] = []
  const groups = ['DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW']
  groups.forEach((g, i) => outfield.push(card(`${prefix}-${g}${i}`, g)))
  return { name: prefix, outfield, keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }) }
}

function freshMatch(): MatchState {
  return createMatch({ home: squad('home'), away: squad('away'), difficulty: 'competitive' })
}

/** A cell no auto-placed player occupies, so a forced stack has exactly two players. */
const EMPTY_CELL = { col: 1, row: 2 }

/** Force two players onto one cell with an explicit stacking, for marcaje tests. */
function stack(state: MatchState, top: string, bottom: string, cell = EMPTY_CELL) {
  state.players[top] = { ...state.players[top], cell, onTop: true }
  state.players[bottom] = { ...state.players[bottom], cell, onTop: false }
}

describe('createMatch', () => {
  it('places 22 players — 11 per side — all with distinct ids', () => {
    const s = freshMatch()
    const ids = Object.keys(s.players)
    expect(ids).toHaveLength(22)
    expect(new Set(ids).size).toBe(22)
    expect(ids.filter((id) => id.startsWith('h'))).toHaveLength(11)
    expect(ids.filter((id) => id.startsWith('a'))).toHaveLength(11)
  })

  it('starts home kicking off with the ball on its centre-forward', () => {
    const s = freshMatch()
    expect(s.phase).toEqual({ kind: 'kickoff', side: 'home' })
    expect(s.attacker).toBe('home')
    expect(s.ball.carrier).not.toBeNull()
    const carrier = s.players[s.ball.carrier!]
    expect(carrier.side).toBe('home')
    // The ball's tracked cell always matches its carrier's cell.
    expect(s.ball.cell).toEqual(carrier.cell)
  })

  it('gives the kicker an adjacent teammate for the mandatory opening pase directo', () => {
    const s = freshMatch()
    const carrier = s.players[s.ball.carrier!]
    const mate = Object.values(s.players).find(
      (p) => p.side === 'home' && p.id !== carrier.id && distance(p.cell, carrier.cell) === 1,
    )
    expect(mate).toBeDefined()
  })

  it('is a legal board: keepers in the portería, everyone else one-per-cell in own half', () => {
    const s = freshMatch()
    const perCell = new Map<string, number>()
    for (const p of Object.values(s.players)) {
      const isKeeper = p.id === playerId(p.side, 0)
      if (isKeeper) {
        expect(isKeeperCell(p.cell)).toBe(true)
        expect(keeperCell(p.side)).toEqual(p.cell)
        continue
      }
      // Outfielders sit inside the board, in their own half.
      expect(isKeeperCell(p.cell)).toBe(false)
      if (p.side === 'home') expect(p.cell.row).toBeLessThanOrEqual(2)
      else expect(p.cell.row).toBeGreaterThanOrEqual(3)
      const key = `${p.cell.col},${p.cell.row}`
      perCell.set(key, (perCell.get(key) ?? 0) + 1)
    }
    for (const count of perCell.values()) expect(count).toBe(1)
  })
})

describe('autoPlace lines each team up by demarcación', () => {
  /** A keeper + outfield with the given per-line counts (summing to 10). */
  function lineup(prefix: string, df: number, mf: number, fw: number): EngineSquad {
    const outfield: EngineCard[] = []
    const add = (g: string, n: number) => {
      for (let i = 0; i < n; i++) outfield.push(card(`${prefix}-${g}${i}`, g))
    }
    add('DF', df)
    add('MF', mf)
    add('FW', fw)
    return { name: prefix, outfield, keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }) }
  }

  const outfieldOf = (s: MatchState, side: Side) =>
    Object.values(s.players).filter((p) => p.side === side && !isKeeperCell(p.cell))

  const colsOnRow = (s: MatchState, side: Side, row: number) =>
    outfieldOf(s, side)
      .filter((p) => p.cell.row === row)
      .map((p) => p.cell.col)
      .sort((a, b) => a - b)

  it('puts defenders on the row by the keeper, midfielders next, forwards ahead (home)', () => {
    const s = createMatch({ home: lineup('home', 4, 3, 3), away: squad('away'), difficulty: 'competitive' })
    const rowsFor = (pos: string) =>
      new Set(outfieldOf(s, 'home').filter((p) => p.card.position === pos).map((p) => p.cell.row))
    expect(rowsFor('DF')).toEqual(new Set([0]))
    expect(rowsFor('MF')).toEqual(new Set([1]))
    expect(rowsFor('FW')).toEqual(new Set([2]))
  })

  it('spreads a 4-3-3 evenly and centred on each line', () => {
    const s = createMatch({ home: lineup('home', 4, 3, 3), away: squad('away'), difficulty: 'competitive' })
    expect(colsOnRow(s, 'home', 0)).toEqual([0, 1, 3, 4]) // 4 defenders
    expect(colsOnRow(s, 'home', 1)).toEqual([0, 2, 4]) // 3 midfielders
    expect(colsOnRow(s, 'home', 2)).toEqual([0, 2, 4]) // 3 forwards
  })

  it('fills a full five-player line across every column', () => {
    const s = createMatch({ home: lineup('home', 5, 3, 2), away: squad('away'), difficulty: 'competitive' })
    expect(colsOnRow(s, 'home', 0)).toEqual([0, 1, 2, 3, 4]) // 5 defenders
    expect(colsOnRow(s, 'home', 1)).toEqual([0, 2, 4]) // 3 midfielders
    expect(colsOnRow(s, 'home', 2)).toEqual([1, 3]) // 2 forwards
  })

  it('mirrors the away side into its own half (rows 5→3)', () => {
    const s = createMatch({ home: squad('home'), away: lineup('away', 4, 3, 3), difficulty: 'competitive' })
    const rowsFor = (pos: string) =>
      new Set(outfieldOf(s, 'away').filter((p) => p.card.position === pos).map((p) => p.cell.row))
    expect(rowsFor('DF')).toEqual(new Set([5]))
    expect(rowsFor('MF')).toEqual(new Set([4]))
    expect(rowsFor('FW')).toEqual(new Set([3]))
  })
})

describe('marcajeOf — derived from stacking (rulebook page 4)', () => {
  it('is SM when a player is alone in the cell', () => {
    const s = freshMatch()
    const alone = playerId('home', 5)
    expect(occupants(s, s.players[alone].cell)).toHaveLength(1)
    expect(marcajeOf(s, alone)).toBe('SM')
  })

  it('is MH for the player an opponent stands on top of', () => {
    const s = freshMatch()
    stack(s, playerId('away', 5), playerId('home', 5))
    expect(marcajeOf(s, playerId('home', 5))).toBe('MH')
  })

  it('is MZ for the player on top (opponent underneath, marking en zona)', () => {
    const s = freshMatch()
    stack(s, playerId('home', 5), playerId('away', 5))
    expect(marcajeOf(s, playerId('home', 5))).toBe('MZ')
  })

  it('reads LIBRE — not SM — when a marked player carries the invalidated-mark flag', () => {
    const s = freshMatch()
    // Geometrically marcado en zona, but a failed defensive action freed them.
    stack(s, playerId('home', 5), playerId('away', 5))
    s.libre = playerId('home', 5)
    expect(marcajeOf(s, playerId('home', 5))).toBe('LIBRE')
    // The flag does not turn a lone player into LIBRE — alone is always SM.
    const lone = playerId('home', 6)
    s.libre = lone
    expect(marcajeOf(s, lone)).toBe('SM')
  })
})

describe('occupancy invariants (rulebook page 3)', () => {
  it('canOccupy allows a lone opponent cell but refuses a full cell or a same-team cell', () => {
    const s = freshMatch()
    const cell = EMPTY_CELL
    // Empty midfield cell: either side may enter.
    expect(canOccupy(s, cell, 'home')).toBe(true)
    // One home player there: away may join, home may not (no two teammates).
    s.players[playerId('home', 5)] = { ...s.players[playerId('home', 5)], cell, onTop: false }
    expect(canOccupy(s, cell, 'away')).toBe(true)
    expect(canOccupy(s, cell, 'home')).toBe(false)
    // Two players there: nobody else may enter.
    s.players[playerId('away', 5)] = { ...s.players[playerId('away', 5)], cell, onTop: true }
    expect(canOccupy(s, cell, 'home')).toBe(false)
    expect(canOccupy(s, cell, 'away')).toBe(false)
  })

  it('never lets anyone occupy a keeper cell', () => {
    const s = freshMatch()
    for (const side of ['home', 'away'] as Side[]) {
      expect(canOccupy(s, keeperCell('home'), side)).toBe(false)
      expect(canOccupy(s, keeperCell('away'), side)).toBe(false)
    }
  })
})

describe('geometry helpers', () => {
  it('neighbours is 8-connected and clamped to the board', () => {
    expect(neighbours({ col: 2, row: 2 })).toHaveLength(8)
    expect(neighbours({ col: 0, row: 0 })).toHaveLength(3) // corner
    expect(neighbours({ col: 2, row: 0 })).toHaveLength(5) // edge
    // Never returns a keeper cell.
    for (const n of neighbours({ col: 2, row: 0 })) expect(isKeeperCell(n)).toBe(false)
  })

  it('distance is Chebyshev (a diagonal step is one move)', () => {
    expect(distance({ col: 2, row: 2 }, { col: 3, row: 3 })).toBe(1)
    expect(distance({ col: 1, row: 1 }, { col: 3, row: 2 })).toBe(2)
    expect(distance({ col: 0, row: 0 }, { col: 0, row: 3 })).toBe(3)
  })
})

describe('serialization', () => {
  it('survives a JSON round trip unchanged (no closures, no object identity)', () => {
    const s = freshMatch()
    const clone: MatchState = JSON.parse(JSON.stringify(s))
    expect(clone).toEqual(s)
    // And the derived queries agree on the rehydrated copy.
    stack(clone, playerId('away', 5), playerId('home', 5))
    expect(marcajeOf(clone, playerId('home', 5))).toBe('MH')
  })
})
