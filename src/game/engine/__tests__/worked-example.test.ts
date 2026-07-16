import { describe, it, expect } from 'vitest'
import { scoreContest } from '@/game/engine/dice'
import {
  CONTESTED_PLAYS,
  INITIAL_PLACEMENT,
  LINEUPS,
} from './fixtures/worked-example'

/**
 * Replay the rulebook's worked example (docs/rulebook/pages 13–17) against the pure
 * resolution layer. Every dice value was verified against the physical booklet in
 * PR #16, so this pins `scoreContest` / keeper saves to the game's own numbers. When
 * the real board engine lands, the same fixture upgrades to a full match replay.
 */
describe('rulebook worked example — resolution layer', () => {
  it.each(CONTESTED_PLAYS)(
    'play $n: $actor $action $dice + $rating → $expected',
    ({ dice, rating, expected }) => {
      // For an attacker action `!` = conseguido; for a keeper save `!` = shot stopped.
      // Both reduce to the same contest reaching the target.
      expect(scoreContest(dice, rating).success).toBe(expected === '!')
    },
  )

  it('reaches Kiko\'s goal (play 53): RM beats the keeper\'s RF', () => {
    const shot = CONTESTED_PLAYS.find((p) => p.n === 53 && p.action === 'RM')!
    const save = CONTESTED_PLAYS.find((p) => p.n === 53 && p.action === 'RF')!
    expect(scoreContest(shot.dice, shot.rating).success).toBe(true)
    expect(scoreContest(save.dice, save.rating).success).toBe(false) // ¡GOL!
  })
})

describe('rulebook worked example — Figura 1 placement integrity', () => {
  const sides = ['blanco', 'negro'] as const

  it.each(sides)('%s fields 10 distinct outfielders (dorsals 1–11, keeper apart)', (side) => {
    const { keeperDorsal, outfield } = INITIAL_PLACEMENT[side]
    expect(outfield).toHaveLength(10)
    expect(LINEUPS[side]).toHaveLength(11)
    const dorsals = outfield.map((p) => p.dorsal)
    expect(new Set(dorsals).size).toBe(10)
    expect(dorsals).not.toContain(keeperDorsal)
    for (const d of dorsals) {
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(11)
    }
  })

  it.each(sides)('%s places every outfielder on the 5×6 board', (side) => {
    for (const { col, row } of INITIAL_PLACEMENT[side].outfield) {
      expect(col).toBeGreaterThanOrEqual(0)
      expect(col).toBeLessThan(5)
      expect(row).toBeGreaterThanOrEqual(1)
      expect(row).toBeLessThanOrEqual(6)
    }
  })

  it('never stacks more than two players (one per team) on a cell', () => {
    const perCell = new Map<string, number>()
    for (const side of sides) {
      for (const { col, row } of INITIAL_PLACEMENT[side].outfield) {
        const key = `${col},${row}`
        perCell.set(key, (perCell.get(key) ?? 0) + 1)
      }
    }
    for (const count of perCell.values()) expect(count).toBeLessThanOrEqual(2)
  })

  it('starts the ball on a real outfielder', () => {
    const { side, dorsal } = INITIAL_PLACEMENT.ballOn
    expect(INITIAL_PLACEMENT[side].outfield.some((p) => p.dorsal === dorsal)).toBe(true)
  })
})
