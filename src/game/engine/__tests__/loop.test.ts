import { describe, it, expect } from 'vitest'
import { simulateMatch } from '@/game/engine/index'
import { generateOpponent } from '@/game/engine/opponent'
import { createRng } from '@/game/engine/rng'
import type { EngineCard, EngineSquad } from '@/game/engine/types'
import type { Abilities } from '@/lib/types'

const OUTFIELD_KEYS = ['rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm'] as const

function outfield(rating: number): Abilities {
  const a: Abilities = {}
  for (const k of OUTFIELD_KEYS) a[k] = rating
  return a
}

/** Build a uniform squad: 10 outfield players + 1 keeper, all at `rating`. */
function squad(name: string, rating: number): EngineSquad {
  const players: EngineCard[] = Array.from({ length: 10 }, (_, i) => ({
    id: `${name}-${i}`,
    name: `${name} ${i}`,
    position: 'MF',
    abilities: outfield(rating),
  }))
  const keeper: EngineCard = {
    id: `${name}-gk`,
    name: `${name} GK`,
    position: 'GK',
    abilities: { rf: rating, co: rating },
  }
  return { name, outfield: players, keeper }
}

describe('simulateMatch', () => {
  it('is deterministic: same input + seed → identical outcome', () => {
    const input = {
      home: squad('Casa', 3),
      away: squad('Fuera', 2),
      difficulty: 'normal' as const,
      seed: 12345,
    }
    const a = simulateMatch(input)
    const b = simulateMatch(input)
    expect(a).toEqual(b)
  })

  it('always terminates with a consistent, non-negative result', () => {
    for (let seed = 0; seed < 200; seed++) {
      const away = generateOpponent('normal', createRng(seed + 1000))
      const out = simulateMatch({ home: squad('Casa', 2), away, difficulty: 'normal', seed })
      expect(out.goals_for).toBeGreaterThanOrEqual(0)
      expect(out.goals_against).toBeGreaterThanOrEqual(0)
      expect(out.log.length).toBeGreaterThan(0)
      const expected =
        out.goals_for > out.goals_against
          ? 'win'
          : out.goals_for < out.goals_against
            ? 'loss'
            : 'draw'
      expect(out.result).toBe(expected)
    }
  })

  it('respects the two-goal winning margin when a match is decided', () => {
    // Most decided matches end on exactly a two-goal swing; assert the margin is
    // never a single goal for a clear win/loss across many seeds.
    let decided = 0
    for (let seed = 0; seed < 100; seed++) {
      const away = generateOpponent('easy', createRng(seed + 5000))
      const out = simulateMatch({ home: squad('Casa', 3), away, difficulty: 'easy', seed })
      if (out.result !== 'draw') {
        decided++
        expect(Math.abs(out.goals_for - out.goals_against)).toBeGreaterThanOrEqual(2)
      }
    }
    expect(decided).toBeGreaterThan(0)
  })

  it('scales with difficulty: a strong squad wins more against easy than hard', () => {
    const count = (difficulty: 'easy' | 'hard') => {
      let wins = 0
      for (let seed = 0; seed < 60; seed++) {
        const away = generateOpponent(difficulty, createRng(seed + 200))
        const out = simulateMatch({ home: squad('Casa', 4), away, difficulty, seed })
        if (out.result === 'win') wins++
      }
      return wins
    }
    expect(count('easy')).toBeGreaterThan(count('hard'))
  })
})
