import { useEffect, useState } from 'react'
import type { Card } from '@/lib/types'
import { fetchCardsByIds } from '@/data/api'

/**
 * Live data for the Landing hero's decorative card fan (replaces a hand-copied
 * constant, which drifted from the catalog). A curated pool of card ids is
 * fetched from the anon-readable `cards` table, cached in `localStorage` with a
 * TTL, and a fresh random trio is shown on each mount — so the fan reflects the
 * real catalog and can't silently go stale, while still rotating for variety.
 *
 * Returns `[]` until a trio is available. The pool comes from the TTL cache when
 * fresh (else a fetch that primes it); the trio is then revealed only once its
 * photos have decoded, so each card deals in fully imaged rather than popping its
 * photo in a beat later. The fan's slots reserve their space, so this reveal never
 * shifts the page. On fetch failure it stays empty — the fan is decorative and
 * `aria-hidden`, so an absent fan is an acceptable degradation.
 */

/**
 * Curated showcase pool — real ids from `supabase/seed_cards.sql`, all with photos,
 * spread across clubs so the crests differ. Includes the three fallback ids. Kept
 * comfortably above 3 so that if a card is later removed from the catalog (dropped
 * silently by `.in()`), the live pool never falls below the three fan slots.
 * Purely cosmetic — edit freely; source new ids from high-cost rows in the seed.
 */
export const SHOWCASE_IDS: string[] = [
  // Real Madrid
  '342229-2526', // Mbappé
  '371998-2526', // Vinícius
  '369081-2526', // Valverde
  '581678-2526', // Bellingham (fallback)
  '413112-2526', // Tchouaméni
  // FC Barcelona
  '937958-2526', // Yamal
  '683840-2526', // Pedri
  '411295-2526', // Raphinha (fallback)
  '411975-2526', // Koundé
  // Atlético de Madrid
  '576024-2526', // Álvarez
  '844637-2526', // Pubill (fallback)
  '121483-2526', // Oblak
  // Others (crest variety)
  '709187-2526', // Williams · Athletic Club
  '805714-2526', // Veiga · Villarreal CF
]

/** localStorage key holding the cached pool. Bump the version on any Card-shape
 *  change so stale-shaped entries are ignored instead of rendered. */
const CACHE_KEY = 'sg.showcase.v1'
/** How long a cached pool is served before refetching. Decorative data, so a long
 *  TTL is fine; the tradeoff is that a catalog edit takes up to this long to show. */
const TTL_MS = 12 * 60 * 60 * 1000 // 12h

interface CacheEntry {
  ts: number
  cards: Card[]
}

/** Read the cached pool if present, fresh (within TTL) and shaped like a non-empty
 *  Card[]. Any problem (missing, corrupt JSON, quota/private-mode read error) is a
 *  cache miss, not a throw. */
function readCache(): Card[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!entry || !Array.isArray(entry.cards) || entry.cards.length === 0) return null
    if (Date.now() - entry.ts >= TTL_MS) return null
    return entry.cards
  } catch {
    return null
  }
}

/** Best-effort persist. Swallows quota / Safari-private-mode write errors — a
 *  failed write just means the next visit refetches. */
function writeCache(cards: Card[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), cards } satisfies CacheEntry))
  } catch {
    /* ignore */
  }
}

/** Random 3 distinct cards from the pool via a partial Fisher–Yates over a copy
 *  (an unbiased shuffle, unlike `sort(() => Math.random() - 0.5)`). Cosmetic
 *  variety, so plain `Math.random` is right here — the seeded engine RNG is not. */
function pickThree(pool: Card[]): Card[] {
  const copy = pool.slice()
  const n = Math.min(3, copy.length)
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, 3)
}

/** Longest we wait on photo decoding before revealing the fan anyway — so one
 *  slow/stalled image can't hold the hero blank. */
const PRELOAD_CAP_MS = 2500

/**
 * Resolve once the trio's photos are decoded (or `PRELOAD_CAP_MS` elapses).
 * Revealing only after decode means each card deals in already-imaged, instead
 * of the photo popping in a beat after the card. A missing/404 photo resolves
 * immediately (Naipe shows the silhouette), so it never blocks the others.
 */
function preloadPhotos(cards: Card[]): Promise<void> {
  const decoded = Promise.all(
    cards.map((c) => {
      if (!c.image_url) return Promise.resolve()
      const img = new Image()
      img.src = c.image_url
      return img.decode().catch(() => undefined)
    }),
  ).then(() => undefined)
  const cap = new Promise<void>((resolve) => setTimeout(resolve, PRELOAD_CAP_MS))
  return Promise.race([decoded, cap])
}

/**
 * Returns a trio for the hero fan, or `[]` until one is available. Resolves the
 * pool (from the TTL cache, else a fetch that primes it), then reveals a random
 * trio only once its photos have decoded — so the cards deal in fully imaged.
 * Stays empty on fetch failure: the fan is decorative and `aria-hidden`.
 */
export function useShowcaseCards(): Card[] {
  const [cards, setCards] = useState<Card[]>([])

  useEffect(() => {
    let alive = true
    const reveal = (pool: Card[]) => {
      if (pool.length < 3) return // too few live cards: leave the fan empty
      const trio = pickThree(pool)
      preloadPhotos(trio).then(() => {
        if (alive) setCards(trio)
      })
    }

    const cached = readCache()
    if (cached) {
      reveal(cached)
    } else {
      fetchCardsByIds(SHOWCASE_IDS)
        .then((pool) => {
          if (!alive) return
          if (pool.length >= 3) writeCache(pool)
          reveal(pool)
        })
        .catch(() => {
          // Decorative + aria-hidden: on failure leave the fan empty rather than
          // erroring the page.
        })
    }
    return () => {
      alive = false
    }
  }, [])

  return cards
}
