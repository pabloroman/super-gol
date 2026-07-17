import { describe, it, expect } from 'vitest'
import type { Rng } from '@/game/engine/rng'
import type { EngineCard, EngineSquad } from '@/game/engine/types'
import {
  createMatch,
  legalActions,
  apply,
  marcajeOf,
  playerId,
  type MatchState,
  type Action,
} from '@/game/board'
import { chooseAction } from '@/game/board/ai'

function card(id: string, position: string, abilities: EngineCard['abilities'] = {}): EngineCard {
  return { id, name: id, position, abilities }
}

function squad(prefix: string, ab: EngineCard['abilities'] = {}): EngineSquad {
  const groups = ['DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW']
  return {
    name: prefix,
    outfield: groups.map((g, i) => card(`${prefix}-${g}${i}`, g, ab)),
    keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }),
  }
}

function freshMatch(homeAb: EngineCard['abilities'] = {}): MatchState {
  return createMatch({ home: squad('home', homeAb), away: squad('away'), difficulty: 'normal' })
}

/** An Rng that hands out a fixed queue of die faces, for deterministic contests. */
function scriptedRng(faces: number[]): Rng {
  let i = 0
  const d6 = () => faces[i++]
  return {
    d6,
    next: () => 0,
    int: () => 0,
    pick: <T>(xs: readonly T[]): T => xs[0],
    chance: () => false,
  }
}

/** An Rng that never rolls — for automatic actions (PD) that must not draw dice. */
const noRng: Rng = scriptedRng([])

function legal(state: MatchState): Action[] {
  return legalActions(state)
}

describe('kickoff', () => {
  it('offers only pases directos to adjacent teammates, and completes automatically', () => {
    const s = freshMatch()
    expect(s.phase.kind).toBe('kickoff')
    const opts = legal(s)
    expect(opts.length).toBeGreaterThan(0)
    expect(opts.every((a) => a.kind === 'pass' && a.pass === 'PD')).toBe(true)

    const { state: after, events } = apply(s, opts[0], noRng)
    expect(after.phase).toEqual({ kind: 'attack', side: 'home' })
    expect(after.ball.carrier).toBe((opts[0] as { to: string }).to)
    expect(events[0].type).toBe('kickoff')
  })
})

describe('a completed pase corto leaves the marks unchanged (page 6)', () => {
  it('keeps possession and does not alter the receiver marcaje', () => {
    const s = freshMatch({ pc: 3 })
    const kick = legal(s)[0]
    let st = apply(s, kick, noRng).state
    // Man-mark the current carrier so a PC is offered.
    const carrierId = st.ball.carrier!
    const ccell = st.players[carrierId].cell
    // Place an away defender on top of the carrier.
    st = structuredMark(st, playerId('away', 7), carrierId, ccell)
    expect(marcajeOf(st, carrierId)).toBe('MH')
    // A PC to an adjacent teammate should exist.
    const pc = legal(st).find((a) => a.kind === 'pass' && a.pass === 'PC')
    expect(pc).toBeDefined()
    const before = marcajeOf(st, (pc as { to: string }).to)
    // Passer is MH → TABLA 1 rolls max(2, 0) = 2 dice. 4 + 4 + 3 = 11 ≥ 10 → success.
    const res = apply(st, pc!, scriptedRng([4, 4])).state
    expect(res.ball.carrier).toBe((pc as { to: string }).to)
    expect(marcajeOf(res, res.ball.carrier!)).toBe(before)
  })
})

describe('regate (rulebook page 9→10)', () => {
  function markedCarrier(): { st: MatchState; carrierId: string } {
    let base = freshMatch({ rg: 2 })
    base = apply(base, legal(base)[0], noRng).state
    const carrierId = base.ball.carrier!
    const st = structuredMark(base, playerId('away', 7), carrierId, base.players[carrierId].cell)
    return { st, carrierId }
  }

  it('success: the carrier keeps the ball, goes on top, and is libre next jugada', () => {
    const { st, carrierId } = markedCarrier()
    // Man-marked → 2 dice. 4 + 4 + 2 = 10 → success.
    const res = apply(st, { kind: 'regate' }, scriptedRng([4, 4])).state
    expect(res.ball.carrier).toBe(carrierId)
    expect(res.players[carrierId].onTop).toBe(true)
    expect(res.libre).toBe(carrierId)
    expect(res.attacker).toBe('home')
  })

  it('failure: the DEFENDER takes the ball (the transition the old engine got wrong)', () => {
    const { st } = markedCarrier()
    const marker = playerId('away', 7)
    // 1 + 1 + 2 = 4 → fail.
    const res = apply(st, { kind: 'regate' }, scriptedRng([1, 1])).state
    expect(res.ball.carrier).toBe(marker)
    expect(res.attacker).toBe('away') // possession changed
    expect(res.libre).toBe(marker)
    expect(res.turno).toBe(1) // one possession change
  })
})

describe('a shot on target that beats the keeper is a goal, and re-places the board', () => {
  it('scores, flips the kickoff to the conceding side, and counts the turno', () => {
    // Put the carrier in the RM box with a strong finish and a weak keeper.
    let st = freshMatch({ rm: 3 })
    st = apply(st, legal(st)[0], noRng).state
    const carrierId = st.ball.carrier!
    // Teleport the carrier into an away RM cell (row 5), alone → SM → 1 die.
    st = moveTo(st, carrierId, { col: 2, row: 5 })
    expect(legal(st).some((a) => a.kind === 'shot' && a.shot === 'RM')).toBe(true)
    // Shot: 5 + 5(bonus) + 3 = 13 → on target. Save: 1 + 1 + 2 = 4 → not saved → GOAL.
    const { state: res, events } = apply(st, { kind: 'shot', shot: 'RM' }, scriptedRng([5, 1, 1]))
    expect(res.score.home).toBe(1)
    expect(events.some((e) => e.type === 'goal')).toBe(true)
    expect(res.phase).toEqual({ kind: 'kickoff', side: 'away' })
    expect(res.turno).toBe(1)
  })
})

describe('shots are legal only from the attacking end (the zone map is symmetric)', () => {
  function withCarrierAt(row: number, col = 2): MatchState {
    let st = freshMatch({ rm: 2, dl: 2 })
    st = apply(st, legal(st)[0], noRng).state
    return moveTo(st, st.ball.carrier!, { col, row })
  }
  const shots = (st: MatchState) => legal(st).filter((a) => a.kind === 'shot').map((a) => (a as { shot: string }).shot)

  it('offers no shot from home\'s OWN box or ring (rows 0/1)', () => {
    expect(shots(withCarrierAt(0))).toEqual([])
    expect(shots(withCarrierAt(1))).toEqual([])
  })

  it('offers RM in the attacking box (row 5) and DL in the attacking ring (row 4)', () => {
    expect(shots(withCarrierAt(5))).toContain('RM')
    expect(shots(withCarrierAt(4))).toContain('DL')
  })
})

describe('anti-stall: a player cannot be moved to the same cell twice (page 12)', () => {
  it('drops the repeat from the legal set after the move', () => {
    let st = freshMatch()
    st = apply(st, legal(st)[0], noRng).state
    // Pick a non-carrier home player and a legal destination.
    const mover = playerId('home', 3)
    const move = legal(st).find(
      (a) => a.kind === 'move' && a.player === mover,
    ) as Extract<Action, { kind: 'move' }>
    expect(move).toBeDefined()
    const dest = move.to
    // Apply the move; a defender window opens — decline it to get back to attack.
    st = apply(st, move, noRng).state
    st = apply(st, { kind: 'decline' }, noRng).state
    // The same (player → dest) must no longer be legal.
    const repeat = legal(st).some(
      (a) => a.kind === 'move' && a.player === mover && a.to.col === dest.col && a.to.row === dest.row,
    )
    expect(repeat).toBe(false)
  })
})

describe('a full AI-vs-AI match always completes', () => {
  it('reaches fulltime at the 15-possession clock across several seeds', () => {
    for (const seed of [1, 7, 42, 99, 1234]) {
      let st = createMatch({
        home: squad('home', { pc: 2, pl: 1, rg: 1, rm: 2, dl: 1 }),
        away: squad('away', { pc: 2, pl: 1, rg: 1, rm: 2, dl: 1 }),
        difficulty: 'normal',
      })
      const rng = seededFaces(seed)
      let guard = 0
      while (st.phase.kind !== 'fulltime' && guard++ < 20000) {
        st = apply(st, chooseAction(st, rng, 'normal'), rng).state
      }
      expect(st.phase.kind).toBe('fulltime')
      expect(st.turno).toBeGreaterThanOrEqual(15)
    }
  })
})

describe('legalActions is never empty while the ball is in play', () => {
  it('always offers the attacker at least one action across a random walk', () => {
    let st = freshMatch({ pc: 1, pl: 1, rg: 1, rm: 1, dl: 1 })
    const rng = seededFaces(1234)
    for (let i = 0; i < 200 && st.phase.kind !== 'fulltime'; i++) {
      const opts = legal(st)
      expect(opts.length).toBeGreaterThan(0)
      // Pick a pseudo-random legal action and apply it.
      const pick = opts[Math.abs(hash(i)) % opts.length]
      st = apply(st, pick, rng).state
    }
  })
})

// ── test helpers that reach into state (legal only in tests) ──────────────────

/** Force `topId` on top of `bottomId` at `cell`, so bottom reads as MH. */
function structuredMark(state: MatchState, topId: string, bottomId: string, cell: { col: number; row: number }): MatchState {
  const s = structuredClone(state)
  s.players[bottomId] = { ...s.players[bottomId], cell: { ...cell }, onTop: false }
  s.players[topId] = { ...s.players[topId], cell: { ...cell }, onTop: true }
  if (s.ball.carrier === bottomId) s.ball.cell = { ...cell }
  return s
}

/** Teleport a player (and the ball, if they carry it) to a cell, alone. */
function moveTo(state: MatchState, id: string, cell: { col: number; row: number }): MatchState {
  const s = structuredClone(state)
  s.players[id] = { ...s.players[id], cell: { ...cell }, onTop: false }
  if (s.ball.carrier === id) s.ball.cell = { ...cell }
  return s
}

function hash(n: number): number {
  let x = (n + 1) * 2654435761
  x = (x ^ (x >>> 15)) >>> 0
  return x
}

/** A deterministic d6 stream for the random-walk termination test. */
function seededFaces(seed: number): Rng {
  let s = seed >>> 0
  const next = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    d6: () => Math.floor(next() * 6) + 1,
    pick: <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
  }
}
