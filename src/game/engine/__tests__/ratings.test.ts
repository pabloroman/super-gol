import { describe, it, expect } from 'vitest'
import { abilityValue, isGoalkeeper, keeperStats } from '@/game/ratings'

describe('ratings', () => {
  it('defaults a missing factor to 0 (rulebook page 6)', () => {
    const card = { abilities: { pc: 2 } }
    expect(abilityValue(card, 'pc')).toBe(2)
    expect(abilityValue(card, 'rm')).toBe(0)
    expect(abilityValue(card, 'rf')).toBe(0)
  })

  it('identifies a keeper by position', () => {
    expect(isGoalkeeper({ abilities: {}, position: 'GK' })).toBe(true)
    expect(isGoalkeeper({ abilities: {}, position: 'Portero' })).toBe(true)
    expect(isGoalkeeper({ abilities: {}, position: 'FW' })).toBe(false)
  })

  it('falls back to a keeper rating when position is missing', () => {
    expect(isGoalkeeper({ abilities: { rf: 2 }, position: null })).toBe(true)
    expect(isGoalkeeper({ abilities: { co: 1 } })).toBe(true)
    expect(isGoalkeeper({ abilities: { pc: 3 } })).toBe(false)
  })

  it('reads both keeper stats, defaulting missing to 0', () => {
    expect(keeperStats({ abilities: { rf: 3 } })).toEqual({ rf: 3, co: 0 })
  })
})
