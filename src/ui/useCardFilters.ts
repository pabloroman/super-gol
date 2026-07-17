import { useMemo, useState } from 'react'
import type { Card, Rarity } from '@/lib/types'
import type { PositionGroup } from '@/cards/positions'
import { positionRank } from './positions'

/**
 * Search / filter / sort over a set of cards. Shared by Colección, the Equipo
 * picker and the admin catalog so they stay in step — the catalog is 518 cards
 * and none of them had a decent way to narrow it. (Admin had its own
 * accent-blind `includes()`, so "Militao" matched nothing.)
 */

export type SortKey = 'cost-desc' | 'cost-asc' | 'name' | 'position'

export const SORT_LABEL: Record<SortKey, string> = {
  'cost-desc': 'Ficha ↓',
  'cost-asc': 'Ficha ↑',
  name: 'Nombre',
  position: 'Puesto',
}

export interface CardFilterState {
  query: string
  setQuery: (v: string) => void
  position: PositionGroup | null
  setPosition: (v: PositionGroup | null) => void
  rarity: Rarity | null
  setRarity: (v: Rarity | null) => void
  sort: SortKey
  setSort: (v: SortKey) => void
  /** True when anything is narrowing the list — drives the "clear" affordance. */
  active: boolean
  clear: () => void
}

/** Strip accents so "militao" matches "Militão" and "rudiger" matches "Rüdiger". */
function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * The search predicate, lifted out of the hook so it can be tested as the pure
 * function it is — the repo has no DOM test environment, and this is the only
 * real logic here. See `searchId` on the hook for why the id is opt-in.
 */
export function cardMatchesQuery(card: Card, query: string, searchId = false): boolean {
  const needle = fold(query.trim())
  if (!needle) return true
  const fields = searchId
    ? [card.name, card.full_name, card.club, card.id]
    : [card.name, card.full_name, card.club]
  return fields.some((field) => field && fold(field).includes(needle))
}

export function useCardFilters<T>(
  items: T[],
  getCard: (item: T) => Card,
  {
    initialSort = 'cost-desc' as SortKey,
    /**
     * Also match the card id. Off by default, and that default is load-bearing:
     * ids are slugs of name + club + season (`thibaut-courtois-rma-2526`), so
     * folding them into the player-facing search corpus would make "rma" match
     * every Real Madrid card and "2526" match all 518. The admin catalog wants
     * exactly that — Colección very much does not.
     */
    searchId = false,
  } = {},
): { filtered: T[]; state: CardFilterState } {
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState<PositionGroup | null>(null)
  const [rarity, setRarity] = useState<Rarity | null>(null)
  const [sort, setSort] = useState<SortKey>(initialSort)

  const filtered = useMemo(() => {
    const out = items.filter((item) => {
      const card = getCard(item)
      if (position && card.position !== position) return false
      if (rarity && card.rarity !== rarity) return false
      return cardMatchesQuery(card, query, searchId)
    })

    const collator = new Intl.Collator('es')
    return out.sort((a, b) => {
      const x = getCard(a)
      const y = getCard(b)
      switch (sort) {
        case 'cost-asc':
          return x.cost - y.cost || collator.compare(x.name, y.name)
        case 'name':
          return collator.compare(x.name, y.name)
        case 'position':
          return (
            positionRank(x.position) - positionRank(y.position) ||
            y.cost - x.cost ||
            collator.compare(x.name, y.name)
          )
        case 'cost-desc':
        default:
          return y.cost - x.cost || collator.compare(x.name, y.name)
      }
    })
  }, [items, getCard, query, position, rarity, sort, searchId])

  const state: CardFilterState = {
    query,
    setQuery,
    position,
    setPosition,
    rarity,
    setRarity,
    sort,
    setSort,
    active: Boolean(query.trim() || position || rarity),
    clear: () => {
      setQuery('')
      setPosition(null)
      setRarity(null)
    },
  }

  return { filtered, state }
}
