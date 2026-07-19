import { describe, expect, it } from 'vitest'
import type { Card } from '../../../lib/types'
import { naipeFactors } from '../factors'

function card(over: Partial<Card>): Card {
  return {
    id: 'x',
    name: 'X',
    full_name: null,
    club: null,
    club_slug: null,
    nationality: null,
    birth_date: null,
    height_cm: null,
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
  it('prints exactly the present outfield factors, in rulebook display order', () => {
    // A sparse, position-coherent blob — a centre-forward's core (rm/d/rc/dl/v).
    const striker = card({
      position: 'FW',
      abilities: { rm: 3, d: 3, rc: 2, dl: 2, v: 1 },
    })
    // Order follows OUTFIELD_ABILITY_KEYS, not value: rc, d, v, dl, rm.
    expect(naipeFactors(striker)).toEqual(['rc', 'd', 'v', 'dl', 'rm'])
  })

  it('keeps the rulebook display order regardless of value', () => {
    const c = card({ abilities: { rm: 2, rb: 2, pc: 3 } })
    // rb, then pc, then rm — their fixed order, ignoring the higher pc value.
    expect(naipeFactors(c)).toEqual(['rb', 'pc', 'rm'])
  })

  it('omits factors the player does not have — a missing factor is zero (page 6)', () => {
    const c = card({ abilities: { rb: 2, rm: 0 } })
    expect(naipeFactors(c)).toEqual(['rb'])
  })

  it('prints only the keeper ratings on a portero, never any outfield keys', () => {
    // Generated keepers are sparse (just rf/co), but even a keeper carrying stray
    // outfield keys must show only its keeper ratings — the branch is on position.
    const courtois = card({
      position: 'GK',
      abilities: { rb: 1, pc: 1, rm: 1, rf: 3, co: 2 },
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
