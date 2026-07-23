import { describe, it, expect } from 'vitest'
import type { EngineCard, EngineSquad } from '@/game/engine/types'
import { createMatch, type MatchState } from '@/game/board'
import { actionAbility } from '@/game/board/describe'

function card(id: string, position: string, abilities: EngineCard['abilities'] = {}): EngineCard {
  return { id, name: id, full_name: null, position, abilities }
}

function squad(prefix: string, ab: EngineCard['abilities'] = {}): EngineSquad {
  const groups = ['DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW']
  return {
    name: prefix,
    outfield: groups.map((g, i) => card(`${prefix}-${g}${i}`, g, ab)),
    keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }),
  }
}

/** All home outfielders share `ab`, so the carrier's ratings are known regardless of who it is. */
function matchWith(ab: EngineCard['abilities']): MatchState {
  return createMatch({ home: squad('home', ab), away: squad('away'), difficulty: 'competitive' })
}

describe('actionAbility', () => {
  const s = matchWith({ rm: 3, dl: 1, rg: 2, pc: 2, pl: 1, a: 1, rb: 2 })
  // The carrier at kickoff is a home player, so it carries the home ratings above.
  const to = s.players[s.ball.carrier!].side === 'home' ? 'h1' : 'a1'

  it('maps a shot to the shooter RM / DL', () => {
    expect(actionAbility(s, { kind: 'shot', shot: 'RM' })).toEqual({ key: 'rm', value: 3 })
    expect(actionAbility(s, { kind: 'shot', shot: 'DL' })).toEqual({ key: 'dl', value: 1 })
  })

  it('maps regate to RG', () => {
    expect(actionAbility(s, { kind: 'regate' })).toEqual({ key: 'rg', value: 2 })
  })

  it('maps a contested pass to the passer PC / PL, but a pase directo to nothing', () => {
    expect(actionAbility(s, { kind: 'pass', pass: 'PC', to })).toEqual({ key: 'pc', value: 2 })
    expect(actionAbility(s, { kind: 'pass', pass: 'PL', to })).toEqual({ key: 'pl', value: 1 })
    expect(actionAbility(s, { kind: 'pass', pass: 'PD', to })).toBeNull()
  })

  it('maps a pase al hueco to the passer PC / PL', () => {
    expect(actionAbility(s, { kind: 'hueco', pass: 'PC', to: { col: 2, row: 3 } })).toEqual({
      key: 'pc',
      value: 2,
    })
  })

  it('maps the defensive reactions to A (anticipación) and RB (robo)', () => {
    expect(actionAbility(s, { kind: 'anticipacion', defender: to })).toEqual({ key: 'a', value: 1 })
    expect(actionAbility(s, { kind: 'robo', defender: to, mode: 'move-onto' })).toEqual({
      key: 'rb',
      value: 2,
    })
  })

  it('returns null for actions with no contested roll (movimiento, saque del portero)', () => {
    expect(actionAbility(s, { kind: 'move', player: to, to: { col: 0, row: 0 } })).toBeNull()
    expect(actionAbility(s, { kind: 'keeper_pass', pass: 'PC', to })).toBeNull()
  })

  it('reads a missing factor as zero (rulebook page 6)', () => {
    const bare = matchWith({})
    expect(actionAbility(bare, { kind: 'shot', shot: 'RM' })).toEqual({ key: 'rm', value: 0 })
  })
})
