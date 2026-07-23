import { describe, expect, it } from 'vitest'
import type { Card } from '../../lib/types'
import { cardMatchesQuery } from '../useCardFilters'

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

// A real catalog row: ids are `{transfermarktId}-{season}`, which is the whole
// reason searchId has to be opt-in — the season suffix is a substring of every id.
const militao = card({
  id: '401530-2526',
  full_name: 'Éder Gabriel Militão',
  club: 'Real Madrid',
})

describe('cardMatchesQuery', () => {
  it('folds accents, so an ASCII keyboard finds the card', () => {
    // Admin's old hand-rolled includes() matched none of these.
    expect(cardMatchesQuery(militao, 'militao')).toBe(true)
    expect(cardMatchesQuery(militao, 'Militao')).toBe(true)
    expect(cardMatchesQuery(militao, 'eder')).toBe(true)
    expect(cardMatchesQuery(militao, 'Militão')).toBe(true)
  })

  it('matches full_name and club', () => {
    expect(cardMatchesQuery(militao, 'gabriel')).toBe(true)
    expect(cardMatchesQuery(militao, 'real madrid')).toBe(true)
  })

  it('ignores empty and whitespace-only queries', () => {
    expect(cardMatchesQuery(militao, '')).toBe(true)
    expect(cardMatchesQuery(militao, '   ')).toBe(true)
  })

  it('does not match the id by default — the player-facing default', () => {
    // The season suffix and tm-id are substrings of the id. If they ever matched
    // here, all 518 cards would answer "2526" in Colección.
    expect(cardMatchesQuery(militao, '2526')).toBe(false)
    expect(cardMatchesQuery(militao, '401530')).toBe(false)
  })

  it('matches the id when searchId is on — the admin catalog wants that', () => {
    expect(cardMatchesQuery(militao, '2526', true)).toBe(true)
    expect(cardMatchesQuery(militao, '401530', true)).toBe(true)
    expect(cardMatchesQuery(militao, '401530-2526', true)).toBe(true)
  })

  it('still misses what it should miss', () => {
    expect(cardMatchesQuery(militao, 'barcelona')).toBe(false)
    expect(cardMatchesQuery(militao, 'zzz', true)).toBe(false)
  })
})
