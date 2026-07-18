import { describe, it, expect } from 'vitest'
import {
  scoreContest,
  contestBreakdown,
  diceForPass,
  passDice,
  diceForAction,
} from '@/game/engine/dice'

describe('scoreContest', () => {
  it('adds the +5 constant only for a single-die roll', () => {
    expect(scoreContest([3], 0).total).toBe(8) // 3 + 5 + 0
    expect(scoreContest([3, 3], 0).total).toBe(6) // 3 + 3 + 0, no bonus
  })

  it('treats a zero-dice contest (pase directo) as automatic', () => {
    const c = scoreContest([], 0)
    expect(c.success).toBe(true)
    expect(c.dice).toEqual([])
  })

  it('one die + 5 + X ≥ 10 succeeds only on a 5 or 6 when X=0 (2/6)', () => {
    const successes = [1, 2, 3, 4, 5, 6].filter((f) => scoreContest([f], 0).success)
    expect(successes).toEqual([5, 6])
  })

  it('two dice + X ≥ 10 with X=0 succeeds on exactly 6 of 36 combinations', () => {
    let wins = 0
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        if (scoreContest([a, b], 0).success) wins++
      }
    }
    expect(wins).toBe(6) // sums of 10, 11, 12
  })
})

describe('contestBreakdown — inverts scoreContest for the rulebook sum', () => {
  it('recovers the rating and the +5 bonus a single-die roll folded into the total', () => {
    // Rulebook play 30: «DL ! (5 + D1: 5 + 0)» → total 10.
    const c = scoreContest([5], 0)
    expect(contestBreakdown(c.dice, c.total)).toEqual({
      dice: [5],
      bonus: 5,
      rating: 0,
      total: 10,
      target: 10,
    })
  })

  it('reports no bonus for a two-die roll and recovers the rating', () => {
    // Rulebook play 27: «RG ! (D1: 4 + D2: 4 + 2)» → total 10.
    const c = scoreContest([4, 4], 2)
    expect(contestBreakdown(c.dice, c.total)).toEqual({
      dice: [4, 4],
      bonus: 0,
      rating: 2,
      total: 10,
      target: 10,
    })
  })
})

describe('TABLA 1 — pass dice counts', () => {
  it('a pase corto is automatic between two unmarked players', () => {
    expect(diceForPass('SM', 'PC')).toBe(0)
    expect(passDice('SM', 'SM', 'PC')).toBe(0)
  })

  it('rolls the maximum of passer and receiver counts (page-31 example)', () => {
    // PC from an unmarked passer (0) to a man-marked receiver (2) → 2 dice.
    expect(passDice('SM', 'MH', 'PC')).toBe(2)
  })

  it('a pase largo rolls one die under zona / no mark, two under man-mark', () => {
    expect(passDice('MZ', 'SM', 'PL')).toBe(1)
    expect(passDice('MH', 'SM', 'PL')).toBe(2)
  })
})

describe('TABLA 2 — action dice counts', () => {
  it('rolls two dice under marcaje al hombre, one otherwise', () => {
    expect(diceForAction('MH', 'RM')).toBe(2)
    expect(diceForAction('MZ', 'RM')).toBe(1)
    expect(diceForAction('SM', 'DL')).toBe(1)
    expect(diceForAction('MH', 'RG')).toBe(2)
  })
})

// The rulebook's full worked-example rolls now live in worked-example.test.ts.
