import type { AbilityKey } from '@/lib/types'
import { abilityValue, type RatedCard } from '@/game/ratings'
import { KEEPER_ABILITY_KEYS, OUTFIELD_ABILITY_KEYS } from '@/game/abilities'

/**
 * Which factors the naipe prints, and in what order.
 *
 * The physical card carries a **variable-length** strip — «Cada carta sólo lleva
 * las características "de las que está dotado" el jugador, así que la fila varía
 * de una carta a otra» (rulebook page 2). The generator now emits sparse,
 * position-coherent cards (only a role's core factors are present; everything
 * else is absent and reads as 0), so we simply print what's there, in the
 * rulebook's fixed display order (src/game/abilities.ts). No value-ranking or cap
 * is needed — the blob is already the card's true, short factor set.
 */

/**
 * The factors to print on `card`, in rulebook display order.
 *
 * Keepers get only their own ratings. This branches on `position` and
 * deliberately does **not** use `isGoalkeeper` from src/game/ratings.ts, which
 * answers a different question — *which of eleven starters keeps goal* — and so
 * falls back to `rf > 0 || co > 0` when a squad has no explicit portero. As a
 * display rule that fallback is wrong: `abilities` is freeform jsonb and the
 * admin CSV importer will set any keys on any position, so an outfielder given
 * a stray `rf` would silently render as a portero, printing RF/CO and hiding
 * every factor he actually plays with. Asking the card what it *is* rather than
 * inferring it from its ratings means none ever can.
 */
export function naipeFactors(card: RatedCard): AbilityKey[] {
  const isKeeper = (card.position ?? '').toUpperCase() === 'GK'
  const keys = isKeeper ? KEEPER_ABILITY_KEYS : OUTFIELD_ABILITY_KEYS
  return keys.filter((k) => abilityValue(card, k) > 0)
}
