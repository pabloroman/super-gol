import type { Abilities, AbilityKey } from '@/lib/types'

/**
 * Ability reads for the match engine.
 *
 * Card ability blobs are freeform `jsonb`, so a card may simply not carry a
 * given rating. The rulebook is explicit (page 6): «Si a un jugador le faltara
 * alguno de los factores, se considerará que éste es cero.» All rating reads go
 * through here so that rule lives in exactly one place.
 */

/** The minimal shape the engine needs from a card to read its ratings. */
export interface RatedCard {
  abilities: Abilities
  position?: string | null
}

/** A player's rating for an action; a missing factor counts as 0 (page 6). */
export function abilityValue(card: RatedCard, key: AbilityKey): number {
  return card.abilities[key] ?? 0
}

/**
 * Identify the goalkeeper of a squad. The 11 starters don't self-declare which
 * one is the portero, so fall back through: an explicit position, then the
 * presence of a keeper rating (rf/co), so that whatever data is available still
 * resolves exactly one keeper.
 */
export function isGoalkeeper(card: RatedCard): boolean {
  const pos = (card.position ?? '').toLowerCase()
  if (/^(gk|por|pt)/.test(pos)) return true
  return abilityValue(card, 'rf') > 0 || abilityValue(card, 'co') > 0
}

/** The two goalkeeper ratings, defaulting missing factors to 0. */
export function keeperStats(card: RatedCard): { rf: number; co: number } {
  return { rf: abilityValue(card, 'rf'), co: abilityValue(card, 'co') }
}
