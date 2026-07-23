import { describe, it, expect } from 'vitest'
import { createRng } from '@/game/engine/rng'
import { scoreContest } from '@/game/engine/dice'
import type { EngineCard, EngineSquad, GameMode, Side } from '@/game/engine/types'
import { createMatch, apply, type MatchState } from '@/game/board'
import { chooseAction, successProb } from '@/game/board/ai'

// ── squads ────────────────────────────────────────────────────────────────────
// Realistic ratings on the rulebook's 0–3 scale, and IDENTICAL for both sides, so a
// match's only asymmetry is the AI skill driving each side — that is what isolates the
// mode-skill gap the last test asserts.
function card(id: string, position: string, ab: EngineCard['abilities']): EngineCard {
  return { id, name: id, full_name: null, position, abilities: ab }
}

function squad(prefix: string): EngineSquad {
  const df = { rb: 2, a: 2, rg: 1, pc: 2, pl: 1, rm: 0, dl: 1 }
  const mf = { rb: 1, a: 1, rg: 2, pc: 3, pl: 2, rm: 1, dl: 2 }
  const fw = { rb: 0, a: 1, rg: 2, pc: 2, pl: 1, rm: 3, dl: 2 }
  const groups: [string, EngineCard['abilities']][] = [
    ['DF', df], ['DF', df], ['DF', df], ['DF', df],
    ['MF', mf], ['MF', mf], ['MF', mf],
    ['FW', fw], ['FW', fw], ['FW', fw],
  ]
  return {
    name: prefix,
    outfield: groups.map(([g, ab], i) => card(`${prefix}-${g}${i}`, g, ab)),
    keeper: card(`${prefix}-gk`, 'GK', { rf: 2, co: 2 }),
  }
}

/** Play a full AI-vs-AI match; each side acts with its own mode skill. */
function playMatch(homeMode: GameMode, awayMode: GameMode, seed: number): MatchState {
  let st = createMatch({ home: squad('H'), away: squad('A'), difficulty: awayMode })
  const rng = createRng(seed)
  let guard = 0
  while (st.phase.kind !== 'fulltime' && guard++ < 20000) {
    const side: Side = (st.phase as { side: Side }).side
    st = apply(st, chooseAction(st, rng, side === 'home' ? homeMode : awayMode), rng).state
  }
  return st
}

// ── the odds model is exactly the engine's resolver ─────────────────────────────

/** Brute-force probability that scoreContest(dice, rating).success over all faces. */
function bruteProb(dice: 0 | 1 | 2, rating: number): number {
  if (dice === 0) return scoreContest([], rating).success ? 1 : 0
  let hits = 0
  let total = 0
  if (dice === 1) {
    for (let d = 1; d <= 6; d++) {
      total++
      if (scoreContest([d], rating).success) hits++
    }
  } else {
    for (let a = 1; a <= 6; a++)
      for (let b = 1; b <= 6; b++) {
        total++
        if (scoreContest([a, b], rating).success) hits++
      }
  }
  return hits / total
}

describe('successProb is the closed form of scoreContest', () => {
  it('matches an exhaustive roll-out for every dice count and rating', () => {
    for (const dice of [0, 1, 2] as const) {
      for (let rating = 0; rating <= 5; rating++) {
        expect(successProb(dice, rating)).toBeCloseTo(bruteProb(dice, rating), 10)
      }
    }
  })

  it('pins the rulebook reference odds', () => {
    expect(successProb(0, 0)).toBe(1) // a pase directo is automatic
    expect(successProb(1, 0)).toBeCloseTo(2 / 6) // 1d6+5, need ≥ 5
    expect(successProb(1, 3)).toBeCloseTo(5 / 6) // need ≥ 2
    expect(successProb(2, 0)).toBeCloseTo(6 / 36) // 2d6, need ≥ 10
    expect(successProb(2, 2)).toBeCloseTo(15 / 36) // need ≥ 8
  })
})

// ── every mode plays a complete, sane match ─────────────────────────────────────

describe('AI-vs-AI matches complete in every mode with sane scores', () => {
  for (const mode of ['friendly', 'competitive'] as const) {
    it(`${mode} vs ${mode} always reaches fulltime at the 15-possession clock`, () => {
      let anyGoals = false
      for (const seed of [3, 17, 88, 250, 4096]) {
        const st = playMatch(mode, mode, seed)
        expect(st.phase.kind).toBe('fulltime')
        expect(st.turno).toBeGreaterThanOrEqual(15)
        expect(st.score.home).toBeGreaterThanOrEqual(0)
        expect(st.score.away).toBeGreaterThanOrEqual(0)
        // No runaway: 15 possessions can't plausibly yield a cricket score.
        expect(st.score.home + st.score.away).toBeLessThan(20)
        anyGoals ||= st.score.home + st.score.away > 0
      }
      // A whole mode producing zero goals across five matches would mean the AI never
      // shoots — a dead engine, not a cautious one.
      expect(anyGoals).toBe(true)
    })
  }
})

// ── competitive beats friendly well above chance ────────────────────────────────

describe('competitive beats friendly over many seeded matches', () => {
  it('wins clearly more, and outscores it, with sides swapped each match', () => {
    const N = 80
    let compWins = 0
    let friendlyWins = 0
    let draws = 0
    let compGoals = 0
    let friendlyGoals = 0
    for (let i = 0; i < N; i++) {
      // Swap ends every other match so a home advantage can't flatter either mode.
      const swap = i % 2 === 1
      const st = playMatch(
        swap ? 'friendly' : 'competitive',
        swap ? 'competitive' : 'friendly',
        1000 + i * 7,
      )
      const comp = swap ? st.score.away : st.score.home
      const friendly = swap ? st.score.home : st.score.away
      compGoals += comp
      friendlyGoals += friendly
      if (comp > friendly) compWins++
      else if (friendly > comp) friendlyWins++
      else draws++
    }

    // Deterministic (seeded), so these are fixed numbers; the thresholds sit well inside
    // the observed margin: competitive takes ~70% of decided matches and outscores
    // friendly ~1.7× (the weights are the old hard/easy pair, so the gap is unchanged).
    expect(compWins).toBeGreaterThan(friendlyWins * 2)
    expect(compWins / (compWins + friendlyWins)).toBeGreaterThan(0.6)
    expect(compGoals).toBeGreaterThan(friendlyGoals * 1.3)
    expect(draws).toBeLessThan(N) // sanity: not every match is a stalemate
  })
})
