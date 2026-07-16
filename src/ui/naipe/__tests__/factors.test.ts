import { describe, expect, it } from 'vitest'
import type { Card } from '../../../lib/types'
import { naipeFactors, OUTFIELD_FACTOR_COUNT } from '../factors'

function card(over: Partial<Card>): Card {
  return {
    id: 'x',
    name: 'X',
    full_name: null,
    club: null,
    club_slug: null,
    nationality: null,
    birthplace: null,
    birth_date: null,
    height_cm: null,
    weight_kg: null,
    position: 'FW',
    cost: 5,
    rarity: 'comun',
    is_starter: false,
    abilities: {},
    zone_grid: [],
    image_url: null,
    ...over,
  }
}

describe('naipeFactors', () => {
  it('prints at most six factors for an outfielder', () => {
    // A real generated blob: every outfield key present, floored at 1.
    const mbappe = card({
      position: 'FW',
      abilities: {
        rb: 1, a: 1, rc: 3, d: 3, rg: 1, v: 2, pc: 1, pl: 1, pa: 1, dl: 3, rm: 3,
      },
    })
    const keys = naipeFactors(mbappe)
    expect(keys).toHaveLength(OUTFIELD_FACTOR_COUNT)
    // Highest first; the four 3s lead, then the 2.
    expect(keys.slice(0, 5)).toEqual(['rc', 'd', 'dl', 'rm', 'v'])
  })

  it('orders by value, breaking ties on the rulebook display order', () => {
    const c = card({ abilities: { rm: 2, rb: 2, pc: 3 } })
    // pc leads on value; rb precedes rm in ABILITY_ORDER despite equal values.
    expect(naipeFactors(c)).toEqual(['pc', 'rb', 'rm'])
  })

  it('omits factors the player does not have — a missing factor is zero (page 6)', () => {
    const c = card({ abilities: { rb: 2, rm: 0 } })
    expect(naipeFactors(c)).toEqual(['rb'])
  })

  it('prints only the keeper ratings on a portero, never the outfield padding', () => {
    // The generator gives keepers all 11 outfield keys pinned at 1 plus rf/co.
    const courtois = card({
      position: 'GK',
      abilities: {
        rb: 1, a: 1, rc: 1, d: 1, rg: 1, v: 1, pc: 1, pl: 1, pa: 1, dl: 1, rm: 1,
        rf: 3, co: 2,
      },
    })
    expect(naipeFactors(courtois)).toEqual(['rf', 'co'])
  })

  it('does not mistake an outfielder carrying keeper ratings for a portero', () => {
    // No catalog card trips this today, but `abilities` is freeform jsonb and
    // admin_upsert_cards will accept any keys on any position. isGoalkeeper()
    // in game/ratings.ts falls back to `rf > 0 || co > 0`, so it would call this
    // midfielder a keeper and hide every factor he plays with. The naipe asks
    // the card what it is instead.
    const strayKeeperRating = card({
      position: 'MF',
      abilities: { pc: 3, pl: 3, rb: 2, a: 2, rf: 1, co: 1 },
    })
    const keys = naipeFactors(strayKeeperRating)
    expect(keys).toContain('pc')
    expect(keys).not.toContain('rf')
    expect(keys).not.toContain('co')
  })

  it('handles a card with no abilities at all', () => {
    expect(naipeFactors(card({ abilities: {} }))).toEqual([])
    expect(naipeFactors(card({ position: 'GK', abilities: {} }))).toEqual([])
  })

  it('never mutates the card', () => {
    const abilities = { rb: 1, rm: 3, pc: 2 }
    const c = card({ abilities })
    naipeFactors(c)
    expect(c.abilities).toEqual(abilities)
  })
})
