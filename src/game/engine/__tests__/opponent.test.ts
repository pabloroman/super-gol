import { describe, it, expect } from 'vitest'
import { createRng } from '../rng'
import { generateOpponent } from '../opponent'
import { POINT_CAP } from '@/game/squad'
import type { Card } from '@/lib/types'
import type { EngineSquad, GameMode } from '../types'

// ── a synthetic but realistic draft pool ────────────────────────────────────────
// Only id/name/position/cost/abilities matter to the draft; the rest is filler to
// satisfy the Card type. Each line carries a spread of costs so the value-aware pick
// has something to choose between (and a cheap filler so the cap is always fillable).
function card(id: string, position: string, cost: number): Card {
  return {
    id,
    full_name: id,
    club: null,
    club_slug: null,
    nationality: null,
    birth_date: null,
    height_cm: null,
    position,
    cost,
    rarity: 'comun',
    is_starter: false,
    abilities: {},
    zone_grid: [],
    image_url: null,
  }
}

// 8 cards per line at costs 1..8 — cheapest legal XI (1 GK + 10 cheapest outfield) is
// well under both caps, so every draft is completable.
const CATALOG: Card[] = (['GK', 'DF', 'MF', 'FW'] as const).flatMap((line) =>
  Array.from({ length: 8 }, (_, i) => card(`${line}-${i}`, line, i + 1)),
)

const byId = new Map(CATALOG.map((c) => [c.id, c]))
const squadCost = (sq: EngineSquad): number =>
  [sq.keeper, ...sq.outfield].reduce((sum, p) => sum + (byId.get(p.id)?.cost ?? 0), 0)

const SEEDS = [1, 7, 42, 99, 250, 1000, 4096, 65535]

describe('generateOpponent drafts a legal squad from the catalog', () => {
  for (const mode of ['friendly', 'competitive'] as const) {
    const cap = mode === 'competitive' ? POINT_CAP : 45

    it(`${mode}: 10 outfield + 1 keeper, one per line, within the cap, no dupes`, () => {
      for (const seed of SEEDS) {
        const sq = generateOpponent(mode, CATALOG, createRng(seed))

        // 10 outfield + exactly one keeper.
        expect(sq.outfield).toHaveLength(10)
        expect(sq.keeper.position).toBe('GK')
        expect(sq.outfield.every((p) => p.position !== 'GK')).toBe(true)

        // At least one player in each outfield line (the "≥1 per line" composition rule).
        for (const line of ['DF', 'MF', 'FW']) {
          expect(sq.outfield.some((p) => p.position === line)).toBe(true)
        }

        // Distinct players.
        const ids = [sq.keeper, ...sq.outfield].map((p) => p.id)
        expect(new Set(ids).size).toBe(11)

        // The completability invariant: never overspend the cap.
        expect(squadCost(sq)).toBeLessThanOrEqual(cap)
      }
    })
  }

  it('is deterministic for a given mode + seed', () => {
    const a = generateOpponent('competitive', CATALOG, createRng(123))
    const b = generateOpponent('competitive', CATALOG, createRng(123))
    expect(a.outfield.map((p) => p.id)).toEqual(b.outfield.map((p) => p.id))
    expect(a.keeper.id).toBe(b.keeper.id)
  })

  it('competitive fields a stronger (pricier) squad than friendly', () => {
    // Value-awareness: averaged over seeds, competitive spends materially more than
    // friendly — it drafts toward the expensive end under a higher cap.
    const avg = (mode: GameMode) =>
      SEEDS.reduce((sum, s) => sum + squadCost(generateOpponent(mode, CATALOG, createRng(s))), 0) /
      SEEDS.length
    expect(avg('competitive')).toBeGreaterThan(avg('friendly') * 1.3)
  })

  it('carries no invented club name', () => {
    expect(generateOpponent('competitive', CATALOG, createRng(5)).name).toBe('Rival')
  })
})
