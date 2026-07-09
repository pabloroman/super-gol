import type { Card } from '@/lib/types'

// Rules taken from the original game: field 11 + up to 5 on the bench, capped at 100 points.
export const POINT_CAP = 100
export const STARTER_COUNT = 11
export const MAX_BENCH = 5

export function squadCost(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + c.cost, 0)
}

export interface SquadValidation {
  ok: boolean
  cost: number
  errors: string[]
}

/**
 * Client-side mirror of the server's save_squad validation (see 0003_functions.sql).
 * The server is authoritative; this just gives instant feedback in the builder.
 */
export function validateSquad(starters: Card[], bench: Card[]): SquadValidation {
  const errors: string[] = []
  const all = [...starters, ...bench]
  const cost = squadCost(all)

  if (starters.length !== STARTER_COUNT) {
    errors.push(`Necesitas 11 titulares (tienes ${starters.length}).`)
  }
  if (bench.length > MAX_BENCH) {
    errors.push(`El banquillo admite 5 como máximo (tienes ${bench.length}).`)
  }
  const ids = all.map((c) => c.id)
  if (new Set(ids).size !== ids.length) {
    errors.push('Un jugador no puede repetirse en el equipo.')
  }
  if (cost > POINT_CAP) {
    errors.push(`El equipo cuesta ${cost} puntos (máximo ${POINT_CAP}).`)
  }

  return { ok: errors.length === 0, cost, errors }
}
