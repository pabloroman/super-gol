import { describe, expect, it } from 'vitest'
import type { AbilityKey } from '../../../src/lib/types'
import { ageAt, marketValueToOverall, parseMarketValue } from '../valuation'
import { buildAbilities, costFor, deriveCard, rarityFor } from '../factors'
import { roleProfile } from '../positions'

const OUTFIELD: AbilityKey[] = ['rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm']
const POSITIONS = [
  'Goalkeeper',
  'Centre-Back',
  'Left-Back',
  'Defensive Midfield',
  'Central Midfield',
  'Attacking Midfield',
  'Left Winger',
  'Centre-Forward',
  'Second Striker',
]

describe('parseMarketValue', () => {
  it('parses millions, thousands and bare euros into cents', () => {
    expect(parseMarketValue('€18.00m')).toBe(1_800_000_000)
    expect(parseMarketValue('€900k')).toBe(90_000_000)
    expect(parseMarketValue('€300k')).toBe(30_000_000)
  })
  it('falls back to the default when absent', () => {
    expect(parseMarketValue(null)).toBe(30_000_000)
    expect(parseMarketValue('')).toBe(30_000_000)
  })
})

describe('marketValueToOverall', () => {
  it('is monotonic in market value at fixed age/position', () => {
    const vals = [30_000_000, 100_000_000, 1_000_000_000, 5_000_000_000, 15_000_000_000]
    const overalls = vals.map((v) => marketValueToOverall(v, 27, false))
    for (let i = 1; i < overalls.length; i++) expect(overalls[i]).toBeGreaterThanOrEqual(overalls[i - 1])
  })
  it('keeps overalls within a sane band', () => {
    for (const v of [5_000_000, 30_000_000, 2_500_000_000, 20_000_000_000]) {
      for (const age of [18, 22, 27, 34]) {
        const ov = marketValueToOverall(v, age, false)
        expect(ov).toBeGreaterThanOrEqual(45)
        expect(ov).toBeLessThanOrEqual(95)
      }
    }
  })
  it('lifts keepers via the goalkeeper value multiplier', () => {
    expect(marketValueToOverall(1_800_000_000, 27, true)).toBeGreaterThan(
      marketValueToOverall(1_800_000_000, 27, false),
    )
  })
  it('is deterministic', () => {
    expect(marketValueToOverall(1_500_000_000, 25, false)).toBe(
      marketValueToOverall(1_500_000_000, 25, false),
    )
  })
})

describe('ageAt', () => {
  it('computes whole-year age at the season reference date', () => {
    expect(ageAt('May 11, 1992')).toBe(33)
    expect(ageAt('Jun 24, 2005')).toBe(20)
  })
})

describe('factor invariants', () => {
  it('produces integer factors in [0,3] and well-formed grids for every role and overall', () => {
    for (const pos of POSITIONS) {
      const profile = roleProfile(pos)
      for (let ov = 50; ov <= 95; ov++) {
        const card = deriveCard(pos, ov)
        for (const v of Object.values(card.abilities)) {
          expect(Number.isInteger(v)).toBe(true)
          expect(v).toBeGreaterThanOrEqual(0)
          expect(v).toBeLessThanOrEqual(3)
        }
        expect(card.zone_grid).toHaveLength(4)
        for (const row of card.zone_grid) {
          expect(row).toHaveLength(5)
          for (const cell of row) expect(typeof cell).toBe('boolean')
        }
        expect(['comun', 'frecuente', 'rara']).toContain(card.rarity)
        expect(card.cost).toBeGreaterThanOrEqual(1)
      }
    }
  })

  it('gives every outfield card all eleven outfield factors at >=1', () => {
    const ab = buildAbilities(72, roleProfile('Central Midfield'))
    for (const k of OUTFIELD) expect(ab[k]).toBeGreaterThanOrEqual(1)
  })

  it('is deterministic', () => {
    expect(deriveCard('Centre-Forward', 88)).toEqual(deriveCard('Centre-Forward', 88))
  })
})

describe('role calibration (signature factors track the position)', () => {
  it('an elite centre-forward maxes remate and desmarque', () => {
    const ab = buildAbilities(93, roleProfile('Centre-Forward'))
    expect(ab.rm).toBe(3)
    expect(ab.d).toBeGreaterThanOrEqual(2)
    expect(ab.dl).toBeGreaterThanOrEqual(2)
  })
  it('an elite winger maxes velocidad and regate', () => {
    const ab = buildAbilities(92, roleProfile('Left Winger'))
    expect(ab.v).toBe(3)
    expect(ab.rg).toBe(3)
  })
  it('a strong centre-back leads on robo and anticipación', () => {
    const ab = buildAbilities(80, roleProfile('Centre-Back'))
    expect(ab.rb).toBeGreaterThanOrEqual(2)
    expect(ab.a).toBeGreaterThanOrEqual(2)
  })
  it('a top keeper carries high reflejos and colocación and no invented outfield spikes', () => {
    const ab = buildAbilities(86, roleProfile('Goalkeeper'))
    expect(ab.rf).toBeGreaterThanOrEqual(2)
    expect(ab.co).toBeGreaterThanOrEqual(2)
    expect(ab.rm).toBeLessThanOrEqual(1)
  })
  it('a journeyman is mostly baseline', () => {
    const ab = buildAbilities(60, roleProfile('Central Midfield'))
    const threes = Object.values(ab).filter((v) => v === 3).length
    expect(threes).toBe(0)
  })
})

describe('rarity and cost bands', () => {
  it('bands rarity by overall', () => {
    expect(rarityFor(90)).toBe('rara')
    expect(rarityFor(80)).toBe('frecuente')
    expect(rarityFor(68)).toBe('comun')
  })
  it('scales cost with overall within 1..12', () => {
    expect(costFor(95)).toBeLessThanOrEqual(12)
    expect(costFor(55)).toBeGreaterThanOrEqual(1)
    expect(costFor(85)).toBeGreaterThan(costFor(65))
  })
})
