import { describe, expect, it } from 'vitest'
import type { Card } from '../../lib/types'
import { POINT_CAP, STARTER_COUNT, squadCost, validateSquad } from '../squad'

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

/** `n` distinct cards of `cost` each. */
function squad(n: number, cost = 5): Card[] {
  return Array.from({ length: n }, (_, i) => card({ id: `c${i}`, cost }))
}

describe('validateSquad', () => {
  it('accepts exactly 11 cards inside the point cap', () => {
    const v = validateSquad(squad(STARTER_COUNT, 5))
    expect(v.ok).toBe(true)
    expect(v.errors).toEqual([])
    expect(v.cost).toBe(55)
  })

  // «Se juega con 10 jugadores de campo + 1 portero por cada equipo» — page 12.
  it.each([0, 10, 12, 16])('refuses a squad of %i', (n) => {
    const v = validateSquad(squad(n))
    expect(v.ok).toBe(false)
    expect(v.errors).toContain(`Necesitas 11 titulares (tienes ${n}).`)
  })

  it('refuses a repeated player', () => {
    const dup = [...squad(10), card({ id: 'c0' })]
    expect(dup).toHaveLength(STARTER_COUNT)
    const v = validateSquad(dup)
    expect(v.ok).toBe(false)
    expect(v.errors).toContain('Un jugador no puede repetirse en el equipo.')
  })

  it('refuses a squad over the 100-point cap', () => {
    const v = validateSquad(squad(STARTER_COUNT, 10)) // 110
    expect(v.ok).toBe(false)
    expect(v.cost).toBe(110)
    expect(v.errors).toContain(`El equipo cuesta 110 puntos (máximo ${POINT_CAP}).`)
  })

  it('accepts a squad sitting exactly on the cap', () => {
    // 11 cards costing 100 in total: ten 9s and one 10.
    const onTheNose = [...squad(10, 9), card({ id: 'last', cost: 10 })]
    const v = validateSquad(onTheNose)
    expect(v.cost).toBe(POINT_CAP)
    expect(v.ok).toBe(true)
  })

  // The bench used to spend against the same cap, so a legal XI could be refused
  // for players who never took the field. There is no bench to charge for now.
  it('costs the eleven and nothing else', () => {
    const eleven = squad(STARTER_COUNT, 9) // 99 — one point under
    expect(squadCost(eleven)).toBe(99)
    expect(validateSquad(eleven).ok).toBe(true)
  })

  it('reports every problem at once rather than the first', () => {
    const v = validateSquad([...squad(11, 20), card({ id: 'c0', cost: 20 })])
    expect(v.errors).toHaveLength(3) // count, duplicate, cap
  })
})
