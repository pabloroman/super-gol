import type { Card, Squad } from '@/lib/types'
import { isGoalkeeper } from '@/game/ratings'
import type { EngineSquad } from './types'

/**
 * Build an `EngineSquad` (10 outfield + 1 keeper) from a saved squad and the card
 * catalog, using `isGoalkeeper` to pick out the portero.
 *
 * Pure and Supabase/React-free on purpose: the authoritative `play-match` Edge Function
 * builds the human squad through this exact function when it starts a match.
 */
export function buildEngineSquad(name: string, squad: Squad, catalog: Card[]): EngineSquad {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const starters = squad.slots
    .map((s) => byId.get(s.card_id))
    .filter((c): c is Card => Boolean(c))
    .map((c) => ({
      id: c.id,
      name: c.name,
      full_name: c.full_name,
      position: c.position,
      abilities: c.abilities,
    }))

  if (starters.length === 0) throw new Error('your squad has no starters')

  let keeperIdx = starters.findIndex(isGoalkeeper)
  if (keeperIdx < 0) keeperIdx = 0 // fall back to the first starter
  const keeper = starters[keeperIdx]
  const outfield = starters.filter((_, i) => i !== keeperIdx)
  return { name, outfield, keeper }
}
