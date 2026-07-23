import { describe, expect, it } from 'vitest'
import type { Card } from '../../../lib/types'
import { ageFrom, formatBirthDate, formatHeight, physicalLine } from '../card-data'

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

describe('formatBirthDate', () => {
  it('renders the card format', () => {
    expect(formatBirthDate('1968-03-23')).toBe('23/03/68')
    expect(formatBirthDate('2002-11-25')).toBe('25/11/02')
  })
  it('returns null for missing or unparseable input', () => {
    expect(formatBirthDate(null)).toBeNull()
    expect(formatBirthDate('not a date')).toBeNull()
  })
})

describe('formatHeight', () => {
  it('renders metres with a Spanish decimal comma', () => {
    expect(formatHeight(187)).toBe('1,87')
    expect(formatHeight(180)).toBe('1,80')
    expect(formatHeight(200)).toBe('2,00')
  })
  it('returns null when absent', () => {
    expect(formatHeight(null)).toBeNull()
  })
})

describe('physicalLine', () => {
  it('builds the line from birth date and height, as on the naipe', () => {
    expect(physicalLine(card({ birth_date: '1968-03-23', height_cm: 187 }))).toBe('23/03/68 - 1,87')
  })

  it('degrades to whichever of date / height is present', () => {
    expect(physicalLine(card({ birth_date: '1998-12-20' }))).toBe('20/12/98')
    expect(physicalLine(card({ height_cm: 180 }))).toBe('1,80')
  })

  it('returns null rather than stray separators when nothing is known', () => {
    expect(physicalLine(card({}))).toBeNull()
  })
})

describe('ageFrom', () => {
  const now = new Date('2026-07-17')
  it('counts whole years', () => {
    expect(ageFrom('1998-12-20', now)).toBe(27)
    expect(ageFrom('1992-05-11', now)).toBe(34)
  })
  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageFrom('2000-07-18', now)).toBe(25)
    expect(ageFrom('2000-07-17', now)).toBe(26)
  })
  it('returns null for missing or unparseable input', () => {
    expect(ageFrom(null, now)).toBeNull()
    expect(ageFrom('nope', now)).toBeNull()
  })
})
