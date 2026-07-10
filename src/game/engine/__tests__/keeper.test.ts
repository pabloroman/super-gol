import { describe, it, expect } from 'vitest'
import { createRng } from '@/game/engine/rng'
import { resolveSave, isGoal } from '@/game/engine/keeper'

describe('keeper saves', () => {
  it('saves iff the keeper reaches ≥ 10', () => {
    // rf 8 lifts the minimum 2d6 (2) to exactly 10 → always saves.
    const strong = createRng(1)
    for (let i = 0; i < 50; i++) expect(resolveSave(strong, 8).saved).toBe(true)

    // With rf 0, a save needs a natural 2d6 ≥ 10, so `saved` tracks the total.
    const weak = createRng(2)
    for (let i = 0; i < 50; i++) {
      const { contest, saved } = resolveSave(weak, 0)
      expect(saved).toBe(contest.total >= 10)
    }
  })

  it('always rolls two dice (no single-die save case)', () => {
    const { contest } = resolveSave(createRng(7), 0)
    expect(contest.dice).toHaveLength(2)
  })

  it('a goal needs the shot on target AND the save to fail', () => {
    expect(isGoal(true, false)).toBe(true)
    expect(isGoal(true, true)).toBe(false)
    expect(isGoal(false, false)).toBe(false)
    expect(isGoal(false, true)).toBe(false)
  })
})
