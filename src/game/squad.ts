import type { Card } from '@/lib/types'

// Rules taken from the original game: «10 jugadores de campo + 1 portero» per side
// (rulebook page 12, MODALIDAD DE JUEGO BÁSICO), capped at 100 points. The basic
// game has no bench — substitutes are a regla avanzada (page 28) and out of scope.
export const POINT_CAP = 100
export const STARTER_COUNT = 11

export function squadCost(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.cost, 0)
}

export interface SquadValidation {
  ok: boolean
  cost: number
  errors: string[]
}

/**
 * Client-side mirror of the server's save_squad validation (see 0013_basic_game_squad.sql).
 * The server is authoritative; this just gives instant feedback in the builder.
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

  return { ok: errors.length === 0, cost, errors }
}
