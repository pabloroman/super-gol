import type { Card } from '@/lib/types'
import type { PositionGroup } from '@/cards/positions'

const POSITION_GROUPS: readonly PositionGroup[] = ['GK', 'DF', 'MF', 'FW']

function isPositionGroup(value: string | null | undefined): value is PositionGroup {
  return !!value && (POSITION_GROUPS as readonly string[]).includes(value)
}

// Rules taken from the original game: «10 jugadores de campo + 1 portero» per side
// (rulebook page 12, MODALIDAD DE JUEGO BÁSICO), capped at 100 points. The basic
// game has no bench — substitutes are a regla avanzada (page 28) and out of scope.
export const POINT_CAP = 100
export const STARTER_COUNT = 11

// Composition: exactly one portero, and at least one player in each outfield line.
// The basic game has no formation (rulebook page 12 grants only «10 de campo + 1
// portero»), so the remaining 7 outfielders are unconstrained.
export const GK_COUNT = 1
export const MIN_PER_LINE = 1

export function squadCost(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.cost, 0)
}

/**
 * Count starters per position group. A card whose stored position isn't one of
 * the four known groups counts toward none of them (it still counts toward the
 * total-11 via the array length) — the catalog always sets GK/DF/MF/FW, so this
 * only guards against stray data.
 */
export function squadCounts(cards: Card[]): Record<PositionGroup, number> {
  const counts: Record<PositionGroup, number> = { GK: 0, DF: 0, MF: 0, FW: 0 }
  for (const c of cards) {
    if (isPositionGroup(c.position)) counts[c.position] += 1
  }
  return counts
}

export interface SquadValidation {
  ok: boolean
  cost: number
  errors: string[]
}

/**
 * Client-side mirror of the server's save_squad validation (see 0013_basic_game_squad.sql
 * for count/dupe/cost and 0016_squad_positions.sql for composition). The server is
 * authoritative; this just gives instant feedback in the builder.
 */
export function validateSquad(starters: Card[]): SquadValidation {
  const errors: string[] = []
  const cost = squadCost(starters)

  if (starters.length !== STARTER_COUNT) {
    errors.push(`Necesitas 11 titulares (tienes ${starters.length}).`)
  }
  const ids = starters.map((c) => c.id)
  if (new Set(ids).size !== ids.length) {
    errors.push('Un jugador no puede repetirse en el equipo.')
  }
  if (cost > POINT_CAP) {
    errors.push(`El equipo cuesta ${cost} puntos (máximo ${POINT_CAP}).`)
  }

  const counts = squadCounts(starters)
  if (counts.GK !== GK_COUNT) {
    errors.push(`Necesitas exactamente 1 portero (tienes ${counts.GK}).`)
  }
  if (counts.DF < MIN_PER_LINE) {
    errors.push('Necesitas al menos 1 defensa.')
  }
  if (counts.MF < MIN_PER_LINE) {
    errors.push('Necesitas al menos 1 medio.')
  }
  if (counts.FW < MIN_PER_LINE) {
    errors.push('Necesitas al menos 1 delantero.')
  }

  return { ok: errors.length === 0, cost, errors }
}
