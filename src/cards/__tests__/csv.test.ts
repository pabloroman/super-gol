import { describe, expect, it } from 'vitest'
import type { Card } from '../../lib/types'
import { ZONE_GRIDS } from '../positions'
import { cardsToCsv, parseCardsCsv } from '../csv'

const fw: Card = {
  id: 'mbappe-rma-2526',
  name: 'MBAPPÉ',
  full_name: 'Kylian Mbappé',
  club: 'Real Madrid',
  club_slug: 'rma',
  nationality: 'France',
  birthplace: null,
  birth_date: '1998-12-20',
  height_cm: 178,
  weight_kg: null,
  position: 'FW',
  cost: 11,
  rarity: 'rara',
  is_starter: false,
  abilities: { rc: 3, d: 3, dl: 3, rm: 3, v: 2, rb: 1, a: 1, rg: 1, pc: 1, pl: 1, pa: 1 },
  zone_grid: ZONE_GRIDS.FW,
  image_url: 'https://assets.virtuafc.com/players/2555.webp',
}

const gk: Card = {
  id: 'courtois-rma-2526',
  name: 'COURTOIS',
  full_name: 'Thibaut Courtois',
  club: 'Real Madrid',
  club_slug: 'rma',
  nationality: 'Belgium',
  birthplace: null,
  birth_date: '1992-05-11',
  height_cm: 200,
  weight_kg: null,
  position: 'GK',
  cost: 9,
  rarity: 'rara',
  is_starter: false,
  abilities: { rb: 1, a: 1, rc: 1, d: 1, rg: 1, v: 1, pc: 1, pl: 1, pa: 1, dl: 1, rm: 1, rf: 3, co: 2 },
  zone_grid: ZONE_GRIDS.GK,
  image_url: 'https://assets.virtuafc.com/players/70988.webp',
}

describe('cardsToCsv / parseCardsCsv round trip', () => {
  it('is loss-free for cards with position-default grids', () => {
    const csv = cardsToCsv([fw, gk])
    const { cards, errors } = parseCardsCsv(csv)
    expect(errors).toEqual([])
    expect(cards).toEqual([fw, gk])
  })

  it('omits the zone_grid column when every card matches its position default', () => {
    const csv = cardsToCsv([fw, gk])
    expect(csv.split('\n')[0]).not.toContain('zone_grid')
  })

  it('preserves a non-default grid via an explicit zone_grid column', () => {
    const custom: Card = { ...fw, zone_grid: ZONE_GRIDS.MF } // FW card with an MF grid
    const csv = cardsToCsv([custom])
    expect(csv.split('\n')[0]).toContain('zone_grid')
    const { cards, errors } = parseCardsCsv(csv)
    expect(errors).toEqual([])
    expect(cards[0].zone_grid).toEqual(ZONE_GRIDS.MF)
  })
})

describe('parseCardsCsv validation', () => {
  const header =
    'id,name,position,cost,rarity,rb,a,rc,d,rg,v,pc,pl,pa,dl,rm,rf,co'

  it('skips rows with a bad rarity and reports them', () => {
    const { cards, errors } = parseCardsCsv(`${header}\nx-1,X,FW,5,legendary,1,1,1,1,1,1,1,1,1,1,1,,`)
    expect(cards).toHaveLength(0)
    expect(errors.some((e) => /bad rarity/.test(e))).toBe(true)
  })

  it('rejects an out-of-range ability', () => {
    const { cards, errors } = parseCardsCsv(`${header}\nx-2,X,FW,5,comun,1,1,1,1,1,1,1,1,1,1,9,,`)
    expect(cards).toHaveLength(0)
    expect(errors.some((e) => /out of range/.test(e))).toBe(true)
  })

  it('rejects a row missing an id', () => {
    const { errors } = parseCardsCsv(`${header}\n,X,FW,5,comun,1,1,1,1,1,1,1,1,1,1,1,,`)
    expect(errors.some((e) => /missing id/.test(e))).toBe(true)
  })

  it('derives the grid from position when no zone_grid column is present', () => {
    const { cards } = parseCardsCsv(`${header}\ny-1,Y,DF,6,comun,3,3,1,1,1,1,1,1,2,1,1,,`)
    expect(cards[0].zone_grid).toEqual(ZONE_GRIDS.DF)
  })
})
