import { describe, expect, it } from 'vitest'
import type { Card } from '../../lib/types'
import type { PositionGroup } from '../../cards/positions'
import { POINT_CAP, STARTER_COUNT, squadCost, validateSquad } from '../squad'

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

/** `n` distinct cards of one line, ids namespaced by group so lines don't collide. */
function line(group: PositionGroup, n: number, cost = 5): Card[] {
  return Array.from({ length: n }, (_, i) =>
    card({ id: `${group}-${i}`, position: group, cost }),
  )
}

/** A legal XI: 1 portero + 10 de campo spread across the lines, each `cost`. */
function xi(cost = 5): Card[] {
  return [
    ...line('GK', 1, cost),
    ...line('DF', 4, cost),
    ...line('MF', 3, cost),
    ...line('FW', 3, cost),
  ]
}

/** `n` cards in a single line — for isolating the count/dupe/cap rules. */
function fill(n: number, cost = 5): Card[] {
  return line('FW', n, cost)
}

describe('validateSquad', () => {
  it('accepts a legal XI inside the point cap', () => {
    const v = validateSquad(xi(5))
    expect(v.ok).toBe(true)
    expect(v.errors).toEqual([])
    expect(v.cost).toBe(55)
  })

  // «Se juega con 10 jugadores de campo + 1 portero por cada equipo» — page 12.
  it.each([0, 10, 12, 16])('refuses a squad of %i', (n) => {
    const v = validateSquad(fill(n))
    expect(v.ok).toBe(false)
    expect(v.errors).toContain(`Necesitas 11 titulares (tienes ${n}).`)
  })

  it('refuses a repeated player', () => {
    // Keep the composition legal so the duplicate is the only complaint: drop one
    // forward and re-add a card that reuses the keeper's id in a forward slot.
    const dup = [...xi(5).slice(0, 10), card({ id: 'GK-0', position: 'FW', cost: 5 })]
    expect(dup).toHaveLength(STARTER_COUNT)
    const v = validateSquad(dup)
    expect(v.ok).toBe(false)
    expect(v.errors).toContain('Un jugador no puede repetirse en el equipo.')
  })

  it('refuses a squad over the 70-point cap', () => {
    const v = validateSquad(xi(10)) // 110
    expect(v.ok).toBe(false)
    expect(v.cost).toBe(110)
    expect(v.errors).toContain(`El equipo cuesta 110 puntos (máximo ${POINT_CAP}).`)
  })

  it('accepts a squad sitting exactly on the cap', () => {
    // 11 legal cards costing 70: keeper 10, the ten outfielders 6 each.
    const onTheNose = [
      ...line('GK', 1, 10),
      ...line('DF', 4, 6),
      ...line('MF', 3, 6),
      ...line('FW', 3, 6),
    ]
    const v = validateSquad(onTheNose)
    expect(v.cost).toBe(POINT_CAP)
    expect(v.ok).toBe(true)
  })

  // The bench used to spend against the same cap, so a legal XI could be refused
  // for players who never took the field. There is no bench to charge for now.
  it('costs the eleven and nothing else', () => {
    const eleven = xi(6) // 66 — under the cap
    expect(squadCost(eleven)).toBe(66)
    expect(validateSquad(eleven).ok).toBe(true)
  })

  // Composition — «10 jugadores de campo + 1 portero» (page 12).
  it('refuses a squad with no goalkeeper', () => {
    const noGk = [...line('DF', 4), ...line('MF', 4), ...line('FW', 3)]
    expect(noGk).toHaveLength(STARTER_COUNT)
    const v = validateSquad(noGk)
    expect(v.ok).toBe(false)
    expect(v.errors).toContain('Necesitas exactamente 1 portero (tienes 0).')
  })

  it('refuses a squad with two goalkeepers', () => {
    const twoGk = [...line('GK', 2), ...line('DF', 3), ...line('MF', 3), ...line('FW', 3)]
    expect(twoGk).toHaveLength(STARTER_COUNT)
    const v = validateSquad(twoGk)
    expect(v.ok).toBe(false)
    expect(v.errors).toContain('Necesitas exactamente 1 portero (tienes 2).')
  })

  it.each([
    ['defensa', [...line('GK', 1), ...line('MF', 5), ...line('FW', 5)]],
    ['medio', [...line('GK', 1), ...line('DF', 5), ...line('FW', 5)]],
    ['delantero', [...line('GK', 1), ...line('DF', 5), ...line('MF', 5)]],
  ])('refuses a squad missing a %s', (word, cards) => {
    expect(cards).toHaveLength(STARTER_COUNT)
    const v = validateSquad(cards as Card[])
    expect(v.ok).toBe(false)
    expect(v.errors).toContain(`Necesitas al menos 1 ${word}.`)
  })

  it('accepts a minimal legal composition (1 of each line, rest forwards)', () => {
    const minimal = [...line('GK', 1), ...line('DF', 1), ...line('MF', 1), ...line('FW', 8)]
    expect(minimal).toHaveLength(STARTER_COUNT)
    expect(validateSquad(minimal).ok).toBe(true)
  })

  it('reports every problem at once rather than the first', () => {
    // 12 forwards, one duplicated, all cost 20: count + duplicate + cap, plus the
    // three missing lines (no GK/DF/MF).
    const v = validateSquad([...fill(12, 20), card({ id: 'FW-0', cost: 20 })])
    expect(v.errors).toContain('Necesitas 11 titulares (tienes 13).')
    expect(v.errors).toContain('Un jugador no puede repetirse en el equipo.')
    expect(v.errors).toContain(`El equipo cuesta 260 puntos (máximo ${POINT_CAP}).`)
    expect(v.errors).toContain('Necesitas exactamente 1 portero (tienes 0).')
  })
})
