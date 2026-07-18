import type { AbilityKey } from '@/lib/types'
import { abilityValue, type RatedCard } from '@/game/ratings'
import {
  ABILITY_ORDER,
  KEEPER_ABILITY_KEYS,
  OUTFIELD_ABILITY_KEYS,
} from '@/game/abilities'

/**
 * Which factors the naipe prints, and in what order.
 *
 * The physical card carries a **variable-length** strip — «Cada carta sólo lleva
 * las características "de las que está dotado" el jugador, así que la fila varía
 * de una carta a otra» (rulebook page 2). Hierro's card shows six.
 *
 * Our generated catalog can't express that yet: `buildAbilities` in
 * src/cards/factors.ts baselines *every* key to 1, so all 467 outfield cards
 * carry an identical 11 keys and all 51 keepers carry 13. Printing the blob
 * straight would give every card the same full row and every keeper eleven
 * meaningless outfield 1s.
 *
 * So we pick a display subset. Taking the highest values is not arbitrary: the
 * generator spends its budget *down the role's priority list*
 * (src/cards/positions.ts), so a card's top factors already are its signature
 * ones. This is a stand-in until the generator emits sparse cards — at which
 * point this can simply print what's there.
 */
export const OUTFIELD_FACTOR_COUNT = 6

/** Order two keys by value, breaking ties on the rulebook's display order. */
function byValueThenOrder(card: RatedCard) {
  return (x: AbilityKey, y: AbilityKey) =>
    abilityValue(card, y) - abilityValue(card, x) ||
    ABILITY_ORDER.indexOf(x) - ABILITY_ORDER.indexOf(y)
}

/**
 * The factors to print on `card`, most-defining first.
 *
 * Keepers get only their own ratings. This branches on `position` and
 * deliberately does **not** use `isGoalkeeper` from src/game/ratings.ts, which
 * answers a different question — *which of eleven starters keeps goal* — and so
 * falls back to `rf > 0 || co > 0` when a squad has no explicit portero. As a
 * display rule that fallback is wrong: `abilities` is freeform jsonb and the
 * admin CSV importer will set any keys on any position, so an outfielder given
 * a stray `rf` would silently render as a portero, printing RF/CO and hiding
 * every factor he actually plays with. No card in the catalog trips this today;
 * asking the card what it *is* rather than inferring it from its ratings means
 * none ever can.
 */
export function naipeFactors(card: RatedCard): AbilityKey[] {
  const isKeeper = (card.position ?? '').toUpperCase() === 'GK'

  if (isKeeper) {
    // A keeper's card is about reflejos y colocación; drop the outfield padding.
    return KEEPER_ABILITY_KEYS.filter((k) => abilityValue(card, k) > 0)
  }

  return [...OUTFIELD_ABILITY_KEYS]
    .filter((k) => abilityValue(card, k) > 0)
    .sort(byValueThenOrder(card))
    .slice(0, OUTFIELD_FACTOR_COUNT)
}
