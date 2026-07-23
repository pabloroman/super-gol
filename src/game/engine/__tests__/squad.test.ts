import { describe, expect, it } from 'vitest'
import type { Card, Squad } from '../../../lib/types'
import { buildEngineSquad } from '../squad'

function card(over: Partial<Card>): Card {
  return {
    id: 'x',
    full_name: 'X',
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

function squadOf(cards: Card[]): Squad {
  return {
    id: 1,
    name: 'Mi equipo',
    total_cost: cards.reduce((s, c) => s + c.cost, 0),
    slots: cards.map((c, i) => ({ card_id: c.id, slot: i })),
  }
}

const keeper = card({ id: 'gk', full_name: 'Portero', position: 'GK', abilities: { rf: 3, co: 2 } })
const outfield = Array.from({ length: 10 }, (_, i) =>
  card({ id: `p${i}`, full_name: `Jugador ${i}`, position: 'MF', abilities: { pc: 2 } }),
)
const eleven = [keeper, ...outfield]

describe('buildEngineSquad', () => {
  it('fields every saved slot — 10 outfield + 1 keeper', () => {
    const e = buildEngineSquad('Mi equipo', squadOf(eleven), eleven)
    expect(e.name).toBe('Mi equipo')
    expect(e.keeper.id).toBe('gk')
    expect(e.outfield).toHaveLength(10)
    expect(e.outfield.map((p) => p.id)).toEqual(outfield.map((c) => c.id))
  })

  it('pulls the portero out of the middle of the squad, not just off the front', () => {
    const shuffled = [...outfield.slice(0, 6), keeper, ...outfield.slice(6)]
    const e = buildEngineSquad('Mi equipo', squadOf(shuffled), shuffled)
    expect(e.keeper.id).toBe('gk')
    expect(e.outfield).toHaveLength(10)
    expect(e.outfield.map((p) => p.id)).not.toContain('gk')
  })

  it('falls back to the first card when no one keeps goal', () => {
    const keeperless = Array.from({ length: 11 }, (_, i) =>
      card({ id: `p${i}`, position: 'MF' }),
    )
    const e = buildEngineSquad('Mi equipo', squadOf(keeperless), keeperless)
    expect(e.keeper.id).toBe('p0')
    expect(e.outfield).toHaveLength(10)
  })

  it('refuses an empty squad', () => {
    expect(() => buildEngineSquad('Mi equipo', squadOf([]), eleven)).toThrow(
      /no starters/,
    )
  })

  it('skips a slot whose card is missing from the catalog', () => {
    const squad = squadOf(eleven)
    const e = buildEngineSquad('Mi equipo', squad, eleven.slice(0, 5))
    expect(e.outfield.length + 1).toBe(5)
  })

  it('takes slots in saved order', () => {
    // Slot order is the squad's own; the engine must not re-sort it.
    const reversed = [...outfield].reverse()
    const e = buildEngineSquad('Mi equipo', squadOf([keeper, ...reversed]), eleven)
    expect(e.outfield.map((p) => p.id)).toEqual(reversed.map((c) => c.id))
  })
})
