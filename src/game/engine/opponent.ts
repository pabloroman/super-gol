import type { Rng } from './rng'
import type { EngineCard, EngineSquad, GameMode } from './types'
import type { Card } from '@/lib/types'
import { POINT_CAP } from '@/game/squad'

/**
 * The AI opponent squad is drafted from the LIVE catalog under the SAME rules the human
 * plays by — the point cap and the "≥1 per line" composition — so `competitive` fields a
 * genuine 70-point rival of real LaLiga players, not a synthetic rating knob. Drawing from
 * the catalog (rather than hand-authored squads) also means a mid-season roster re-pull
 * never orphans a fixed opponent: the draft just picks from whatever cards exist.
 *
 * Value-aware and seeded: `competitive` biases each pick to the priciest affordable card
 * (cost is the catalog's quality proxy — see `src/cards/valuation.ts`), `friendly` to the
 * cheapest, under a smaller budget, so it stays soft enough to learn against. The opponent
 * carries no invented club name — it is just "Rival".
 */

const LINES = ['GK', 'DF', 'MF', 'FW'] as const
type Line = (typeof LINES)[number]

/** [DF, MF, FW] outfield splits — each sums to 10 and satisfies "≥1 per line". */
const FORMATIONS = [
  [4, 3, 3],
  [4, 4, 2],
  [3, 5, 2],
  [5, 3, 2],
  [4, 5, 1],
  [3, 4, 3],
] as const

// friendly: a smaller budget + pick from the CHEAP end → a soft, beatable XI.
// competitive: the human's own cap + pick from the EXPENSIVE end → a real 70-pt rival.
const MODE: Record<GameMode, { cap: number; quality: 'high' | 'low' }> = {
  friendly: { cap: 45, quality: 'low' },
  competitive: { cap: POINT_CAP, quality: 'high' },
}

const choose = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)]

function shuffle<T>(rng: Rng, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1))
    ;[xs[i], xs[j]] = [xs[j], xs[i]]
  }
  return xs
}

const isLine = (p: string | null): p is Line =>
  p === 'GK' || p === 'DF' || p === 'MF' || p === 'FW'

const toEngineCard = (c: Card): EngineCard => ({
  id: c.id,
  name: c.name,
  position: c.position,
  abilities: c.abilities,
})

/** Cheapest cost to fill `rest` slots from untaken cards (each line is cost-sorted asc). */
function minCompletion(rest: Line[], byLine: Record<Line, Card[]>, taken: Set<string>): number {
  const count: Record<Line, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
  for (const l of rest) count[l]++
  let sum = 0
  for (const l of LINES) {
    let n = count[l]
    for (const c of byLine[l]) {
      if (n === 0) break
      if (!taken.has(c.id)) {
        sum += c.cost
        n--
      }
    }
  }
  return sum
}

/**
 * Draft a legal, budget-respecting opponent XI (10 outfield + 1 keeper) from `catalog`.
 *
 * Completability invariant: before each pick we reserve `minCompletion` of the remaining
 * slots — the cheapest legal way to finish — so the cap is never overspent and a valid XI
 * can always be completed. This holds for the real catalog (cheapest legal XI ≪ 45 < 70).
 * For `competitive` it is watertight (it never spends a card the reservation needs); for
 * `friendly` the low cap keeps `spent` far from the ceiling regardless.
 */
export function generateOpponent(mode: GameMode, catalog: Card[], rng: Rng): EngineSquad {
  const { cap, quality } = MODE[mode]

  // Bucket by line, cheapest-first so the cheapest untaken cards are a prefix.
  const byLine: Record<Line, Card[]> = { GK: [], DF: [], MF: [], FW: [] }
  for (const c of catalog) if (isLine(c.position)) byLine[c.position].push(c)
  for (const l of LINES) byLine[l].sort((a, b) => a.cost - b.cost)

  const [df, mf, fw] = choose(rng, FORMATIONS)
  const need: Record<Line, number> = { GK: 1, DF: df, MF: mf, FW: fw }

  // A flat slot list, drafted in random order so variety isn't line-ordered.
  const slots: Line[] = []
  for (const l of LINES) for (let i = 0; i < need[l]; i++) slots.push(l)
  shuffle(rng, slots)

  const taken = new Set<string>()
  const picked: Card[] = []
  let spent = 0

  for (let s = 0; s < slots.length; s++) {
    const line = slots[s]
    const ceiling = cap - spent - minCompletion(slots.slice(s + 1), byLine, taken)
    // Options are still cost-sorted asc (filter preserves order); guaranteed non-empty.
    const options = byLine[line].filter((c) => !taken.has(c.id) && c.cost <= ceiling)
    const k = Math.min(4, options.length) // jitter window for variety
    const slice = quality === 'high' ? options.slice(-k) : options.slice(0, k)
    const card = choose(rng, slice)
    picked.push(card)
    taken.add(card.id)
    spent += card.cost
  }

  const keeper = picked.find((c) => c.position === 'GK')!
  return {
    name: 'Rival',
    outfield: picked.filter((c) => c !== keeper).map(toEngineCard),
    keeper: toEngineCard(keeper),
  }
}
