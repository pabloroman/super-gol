import { describe, it, expect } from 'vitest'
import type { Rng } from '@/game/engine/rng'
import type { EngineCard, EngineSquad } from '@/game/engine/types'
import {
  createMatch,
  legalActions,
  apply,
  actionKey,
  keeperCell,
  playerId,
  type MatchState,
  type Action,
  type Cell,
} from '@/game/board'

/**
 * Per-mechanic assertions for the rulebook interruptions and restarts — anticipación,
 * the three robo cases, the pase-al-hueco move order, the keeper restart, and cesión.
 * The full worked-example replay proves these fit together; these pin each one's rule in
 * isolation, including the two the example never exercises cleanly (robo case 3, cesión).
 *
 * The states are hand-built: kick off to reach an `attack` phase, then place the two or
 * three relevant players and set the phase the mechanic starts from. Marcaje is never
 * written — it is read back from the stacking these helpers arrange.
 */

function card(id: string, position: string, abilities: EngineCard['abilities'] = {}): EngineCard {
  return { id, name: id, position, abilities }
}

function squad(prefix: string): EngineSquad {
  const groups = ['DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW']
  return {
    name: prefix,
    outfield: groups.map((g, i) => card(`${prefix}-${g}${i}`, g)),
    keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }),
  }
}

function scriptedRng(faces: number[]): Rng {
  let i = 0
  return {
    d6: () => faces[i++],
    next: () => 0,
    int: () => 0,
    pick: <T>(xs: readonly T[]): T => xs[0],
    chance: () => false,
  }
}
const noRng = scriptedRng([])

/** Kick off so home holds the ball in an `attack` phase — the base for every mechanic. */
function kicked(): MatchState {
  const s = createMatch({ home: squad('home'), away: squad('away'), difficulty: 'competitive' })
  return apply(s, legalActions(s)[0], noRng).state
}

const keys = (st: MatchState): string[] => legalActions(st).map(actionKey)
const setAb = (st: MatchState, id: string, ab: EngineCard['abilities']): void => {
  st.players[id] = { ...st.players[id], card: { ...st.players[id].card, abilities: ab } }
}
const put = (st: MatchState, id: string, cell: Cell, onTop: boolean): void => {
  st.players[id] = { ...st.players[id], cell: { ...cell }, onTop }
  if (st.ball.carrier === id) st.ball.cell = { ...cell }
}

// ── anticipación (page 8) ─────────────────────────────────────────────────────

/** A completed PC/PL: the home receiver holds the ball, an away defender marking him. */
function afterPassToMarkedReceiver(mark: 'MH' | 'MZ', defAb: EngineCard['abilities']): {
  st: MatchState
  receiverId: string
  markerId: string
} {
  const st = structuredClone(kicked())
  const receiverId = st.ball.carrier!
  const markerId = playerId('away', 7)
  const cell = st.players[receiverId].cell
  put(st, receiverId, cell, mark === 'MZ') // receiver on top ⇔ marked en zona
  put(st, markerId, cell, mark === 'MH') // marker on top ⇔ marks al hombre
  setAb(st, markerId, defAb)
  st.phase = { kind: 'defend_interrupt', side: 'away', receiver: receiverId }
  return { st, receiverId, markerId }
}

describe('anticipación (page 8)', () => {
  it('is offered to a marker whether en zona OR al hombre; robo only to a man-marker', () => {
    const zona = afterPassToMarkedReceiver('MZ', { a: 2 })
    expect(keys(zona.st)).toContain(`anticipacion:${zona.markerId}`)
    expect(keys(zona.st)).not.toContain(`robo:${zona.markerId}:after-pass`)

    const hombre = afterPassToMarkedReceiver('MH', { a: 2, rb: 2 })
    // The page-8 failure clause ("si estaba marcando al hombre ...") — and worked-example
    // play 36 — establish that a man-marker may anticipate too.
    expect(keys(hombre.st)).toContain(`anticipacion:${hombre.markerId}`)
    expect(keys(hombre.st)).toContain(`robo:${hombre.markerId}:after-pass`)
  })

  it('success: the anticipator takes the ball on top and is libre; possession changes', () => {
    const { st, markerId } = afterPassToMarkedReceiver('MZ', { a: 2 })
    const res = apply(st, { kind: 'anticipacion', defender: markerId }, scriptedRng([4, 4])).state
    expect(res.ball.carrier).toBe(markerId)
    expect(res.players[markerId].onTop).toBe(true)
    expect(res.libre).toBe(markerId)
    expect(res.attacker).toBe('away')
    expect(res.turno).toBe(1)
  })

  it('failure from en zona: mark unchanged, attacker libre, possession kept', () => {
    const { st, receiverId, markerId } = afterPassToMarkedReceiver('MZ', { a: 2 })
    const res = apply(st, { kind: 'anticipacion', defender: markerId }, scriptedRng([1, 1])).state
    expect(res.ball.carrier).toBe(receiverId)
    expect(res.players[markerId].onTop).toBe(false) // still en zona
    expect(res.libre).toBe(receiverId)
    expect(res.attacker).toBe('home')
    expect(res.phase).toEqual({ kind: 'attack', side: 'home' })
  })

  it('failure from al hombre demotes the marker to en zona (page 8)', () => {
    const { st, receiverId, markerId } = afterPassToMarkedReceiver('MH', { a: 2 })
    const res = apply(st, { kind: 'anticipacion', defender: markerId }, scriptedRng([1, 1])).state
    expect(res.players[markerId].onTop).toBe(false) // MH → MZ
    expect(res.libre).toBe(receiverId)
    expect(res.attacker).toBe('home')
  })
})

// ── robo de balón (page 9) ────────────────────────────────────────────────────

describe('robo de balón — case 1, after a completed pass to a man-marked receiver', () => {
  it('success: defender takes the ball marking al hombre; possession changes', () => {
    const { st, markerId } = afterPassToMarkedReceiver('MH', { rb: 2 })
    const res = apply(st, { kind: 'robo', defender: markerId, mode: 'after-pass' }, scriptedRng([5, 5])).state
    expect(res.ball.carrier).toBe(markerId)
    expect(res.players[markerId].onTop).toBe(true)
    expect(res.libre).toBeNull()
    expect(res.attacker).toBe('away')
  })

  it('failure hands the attacker a free advance (page 9) or a decline', () => {
    const { st, receiverId, markerId } = afterPassToMarkedReceiver('MH', { rb: 2 })
    const failed = apply(st, { kind: 'robo', defender: markerId, mode: 'after-pass' }, scriptedRng([1, 1])).state
    expect(failed.phase).toEqual({ kind: 'robo_advance', side: 'home' })
    expect(failed.ball.carrier).toBe(receiverId)

    // Advance: the holder steps to an adjacent cell (not a "movement") and is libre.
    const adj = legalActions(failed).find((a) => a.kind === 'robo_advance') as Extract<Action, { kind: 'robo_advance' }>
    const advanced = apply(failed, adj, noRng).state
    expect(advanced.ball.carrier).toBe(receiverId)
    expect(advanced.libre).toBe(receiverId)
    expect(advanced.phase).toEqual({ kind: 'attack', side: 'home' })

    // Decline: the man-marker drops to en zona, the holder is libre (page 9).
    const declined = apply(failed, { kind: 'decline_advance' }, noRng).state
    expect(declined.players[markerId].onTop).toBe(false)
    expect(declined.libre).toBe(receiverId)
    expect(declined.phase).toEqual({ kind: 'attack', side: 'home' })
  })
})

/** A `defend_move` window with an away defender positioned relative to the home holder. */
function defendMove(where: 'adjacent' | 'below' | 'ontop'): {
  st: MatchState
  holderId: string
  defId: string
  holderCell: Cell
} {
  const st = structuredClone(kicked())
  const holderId = st.ball.carrier!
  const holderCell = st.players[holderId].cell
  const defId = playerId('away', 7)
  setAb(st, defId, { rb: 3 })
  if (where === 'adjacent') {
    const col = holderCell.col > 0 ? holderCell.col - 1 : holderCell.col + 1
    put(st, defId, { col, row: holderCell.row }, false)
  } else {
    put(st, holderId, holderCell, where === 'below') // holder on top ⇔ def below
    put(st, defId, holderCell, where === 'ontop')
  }
  st.phase = { kind: 'defend_move', side: 'away' }
  return { st, holderId, defId, holderCell }
}

describe('robo de balón — cases 2 & 3, inside a defend_move window (page 9)', () => {
  it('case 2: an adjacent defender may move onto the holder and rob', () => {
    const { st, defId, holderCell } = defendMove('adjacent')
    expect(keys(st)).toContain(`robo:${defId}:move-onto:${holderCell.col},${holderCell.row}`)
    const res = apply(st, { kind: 'robo', defender: defId, mode: 'move-onto', to: holderCell }, scriptedRng([5, 5])).state
    expect(res.ball.carrier).toBe(defId)
    expect(res.players[defId].cell).toEqual(holderCell)
    expect(res.players[defId].onTop).toBe(true)
    expect(res.attacker).toBe('away')
  })

  it('case 2 in place: a zonal marker below the holder may flip on top and rob', () => {
    const { st, defId, holderCell } = defendMove('below')
    expect(keys(st)).toContain(`robo:${defId}:move-onto:${holderCell.col},${holderCell.row}`)
    const res = apply(st, { kind: 'robo', defender: defId, mode: 'move-onto', to: holderCell }, scriptedRng([5, 5])).state
    expect(res.ball.carrier).toBe(defId)
    expect(res.attacker).toBe('away')
  })

  it('case 3: a man-marker already on the holder may renounce his move and rob', () => {
    const { st, defId } = defendMove('ontop')
    expect(keys(st)).toContain(`robo:${defId}:renounce`)
    const res = apply(st, { kind: 'robo', defender: defId, mode: 'renounce' }, scriptedRng([5, 5])).state
    expect(res.ball.carrier).toBe(defId)
    expect(res.attacker).toBe('away')
  })
})

// ── pase al hueco (pages 7–8) ─────────────────────────────────────────────────

describe('pase al hueco — the roll decides move order, not possession (pages 7–8)', () => {
  function huecoFrom(): { st: MatchState; target: Cell } {
    const st = structuredClone(kicked())
    const carrierId = st.ball.carrier!
    put(st, carrierId, { col: 1, row: 2 }, false) // an empty home cell, alone
    return { st, target: { col: 1, row: 3 } } // empty (away's front line holds cols 0,2,4 in row 3)
  }

  it('success: the ball goes loose and the ATTACKER moves first', () => {
    const { st, target } = huecoFrom()
    const res = apply(st, { kind: 'hueco', pass: 'PC', to: target }, scriptedRng([6, 6])).state
    expect(res.ball.carrier).toBeNull()
    expect(res.ball.cell).toEqual(target)
    expect(res.phase).toEqual({ kind: 'hueco_move', side: 'home' })
  })

  it('failure: the ball goes loose and the DEFENDER moves first', () => {
    const { st, target } = huecoFrom()
    const res = apply(st, { kind: 'hueco', pass: 'PC', to: target }, scriptedRng([1, 1])).state
    expect(res.ball.carrier).toBeNull()
    expect(res.phase).toEqual({ kind: 'hueco_move', side: 'away' })
  })
})

// ── keeper restart (page 11) ──────────────────────────────────────────────────

/** The home keeper holding the ball, about to restart (premoves already done). */
function keeperRestart(): MatchState {
  const st = structuredClone(kicked())
  const gk = playerId('home', 0)
  st.attacker = 'home'
  st.ball = { carrier: gk, cell: { ...keeperCell('home') } }
  st.phase = { kind: 'keeper_restart', side: 'home' }
  return st
}

describe('keeper restart (page 11)', () => {
  it('may pass +1 the normal distance: a PD reaches two cells', () => {
    const st = keeperRestart()
    const mate = playerId('home', 5)
    put(st, mate, { col: 2, row: 1 }, false) // distance 2 from the keeper cell (col2,row-1)
    expect(keys(st)).toContain(`keeper_pass:PD:${mate}`)
  })

  it("the keeper's own PC/PL count as zero, even if the card carries a rating", () => {
    const st = keeperRestart()
    setAb(st, playerId('home', 0), { pl: 5 }) // a rating that MUST be ignored
    const mate = playerId('home', 5)
    put(st, mate, { col: 1, row: 2 }, false) // distance 3 from the keeper cell → PL range
    // One die (unmarked): 4 + 5(bonus) + 0 = 9 < 10 → fail. Were pl=5 used, 14 → success.
    const res = apply(st, { kind: 'keeper_pass', pass: 'PL', to: mate }, scriptedRng([4])).state
    expect(res.ball.carrier).not.toBe(mate) // the pass failed, so it never reached him
  })

  it('lets exactly one player per team premove, restarting side first', () => {
    const st = structuredClone(kicked())
    st.attacker = 'home'
    st.ball = { carrier: playerId('home', 0), cell: { ...keeperCell('home') } }
    st.phase = { kind: 'restart_move', side: 'home' }
    const afterHome = apply(st, { kind: 'premove_done' }, noRng).state
    expect(afterHome.phase).toEqual({ kind: 'restart_move', side: 'away' })
    const afterAway = apply(afterHome, { kind: 'premove_done' }, noRng).state
    expect(afterAway.phase).toEqual({ kind: 'keeper_restart', side: 'home' })
  })
})

// ── cesión al portero (page 11) ───────────────────────────────────────────────

/** A marked home carrier standing next to his own keeper, able to cede. */
function cesionSetup(passerPc: number): { st: MatchState; carrierId: string } {
  const st = structuredClone(kicked())
  const carrierId = st.ball.carrier!
  put(st, carrierId, { col: 2, row: 0 }, false) // adjacent to the keeper cell (col2,row-1)
  put(st, playerId('away', 7), { col: 2, row: 0 }, true) // an away man-marker on top → MH
  setAb(st, carrierId, { pc: passerPc })
  return { st, carrierId }
}

describe('cesión al portero (page 11)', () => {
  it('a FAILED pase corto back-pass is an own goal', () => {
    const { st } = cesionSetup(0)
    const gk = playerId('home', 0)
    expect(keys(st)).toContain(`pass:PC:${gk}`)
    // MH passer → two dice; 2 + 2 + 0 = 4 < 10 → failed cesión → gol en propia meta.
    const res = apply(st, { kind: 'pass', pass: 'PC', to: gk }, scriptedRng([2, 2])).state
    expect(res.score.away).toBe(1)
  })

  it("uses the field passer's own PC — a cesión does NOT zero it (page-11 zero is the keeper's)", () => {
    const { st } = cesionSetup(3)
    const gk = playerId('home', 0)
    // 3 + 4 + 3 = 10 → succeeds ONLY because the passer's pc:3 counts. It would be an own
    // goal (7 < 10) if the cesión wrongly zeroed the field player's rating.
    const res = apply(st, { kind: 'pass', pass: 'PC', to: gk }, scriptedRng([3, 4])).state
    expect(res.score.away).toBe(0)
    expect(res.phase).toEqual({ kind: 'keeper_restart', side: 'home' }) // keeper must foot it out
    expect(res.ball.carrier).toBe(gk)
  })
})
