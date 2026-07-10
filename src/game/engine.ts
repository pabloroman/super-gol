import type { Card, MatchOutcome, Squad } from '@/lib/types'
import { requireSupabase } from '@/lib/supabase'
import { fetchActiveSquad, fetchCatalog } from '@/data/api'
import { isGoalkeeper } from '@/game/ratings'
import { simulateMatch, type EngineSquad } from '@/game/engine/index'
import { generateOpponent } from '@/game/engine/opponent'
import { createRng, seedFrom } from '@/game/engine/rng'

/**
 * The match engine is intentionally pluggable.
 *
 * `serverMatchEngine` is the AUTHORITATIVE path: resolution lives in the Postgres
 * function `play_match` (supabase/migrations/0003_functions.sql). It currently is
 * a PLACEHOLDER that turns squad strength into a scoreline with weighted
 * randomness, but it runs server-side so results and rewards can't be forged.
 *
 * `localMatchEngine` runs the REAL basic-game rules (the seeded d6 + ability +
 * marcaje simulation in `src/game/engine/`) entirely on the client. Because the
 * client can't be trusted with coins, it is NOT the default — it exists so the
 * rules engine is exercisable, and so the identical pure module can later be
 * deployed in a Supabase Edge Function to become the authoritative resolver.
 */
export interface MatchEngine {
  play(difficulty: Difficulty): Promise<MatchOutcome>
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Amistoso', blurb: 'Rival flojo. Ideal para empezar.' },
  { id: 'normal', label: 'Liga', blurb: 'Un rival de mitad de tabla.' },
  { id: 'hard', label: 'Champions', blurb: 'Los mejores. Más recompensa.' },
]

/** Authoritative engine: delegates to the server RPC. */
export const serverMatchEngine: MatchEngine = {
  async play(difficulty: Difficulty): Promise<MatchOutcome> {
    const { data, error } = await requireSupabase().rpc('play_match', {
      p_difficulty: difficulty,
    })
    if (error) throw new Error(error.message)
    return data as MatchOutcome
  },
}

/**
 * Build an `EngineSquad` (10 outfield + 1 keeper) from the saved squad and the
 * card catalog, using `isGoalkeeper` to pick out the portero.
 */
function toEngineSquad(name: string, squad: Squad, catalog: Card[]): EngineSquad {
  const byId = new Map(catalog.map((c) => [c.id, c]))
  const starters = squad.slots
    .filter((s) => s.is_starter)
    .map((s) => byId.get(s.card_id))
    .filter((c): c is Card => Boolean(c))
    .map((c) => ({ id: c.id, name: c.name, position: c.position, abilities: c.abilities }))

  if (starters.length === 0) throw new Error('your squad has no starters')

  let keeperIdx = starters.findIndex(isGoalkeeper)
  if (keeperIdx < 0) keeperIdx = 0 // fall back to the first starter
  const keeper = starters[keeperIdx]
  const outfield = starters.filter((_, i) => i !== keeperIdx)
  return { name, outfield, keeper }
}

/**
 * Client-side engine running the real basic-game rules. Not authoritative — see
 * the note above — so it must not be relied on for coins. Selected only when the
 * `VITE_LOCAL_ENGINE` flag is set.
 */
export const localMatchEngine: MatchEngine = {
  async play(difficulty: Difficulty): Promise<MatchOutcome> {
    const [squad, catalog] = await Promise.all([fetchActiveSquad(), fetchCatalog()])
    if (!squad) throw new Error('you have no squad yet')
    const home = toEngineSquad(squad.name || 'Tu equipo', squad, catalog)
    const seed = seedFrom(Date.now(), difficulty, squad.id)
    const away = generateOpponent(difficulty, createRng(seedFrom(seed, 'opponent')))
    return simulateMatch({ home, away, difficulty, seed })
  },
}

/**
 * The engine screens use. Defaults to the authoritative server engine; set
 * `VITE_LOCAL_ENGINE=1` to preview the real rules client-side (no real coins).
 */
export const matchEngine: MatchEngine =
  import.meta.env.VITE_LOCAL_ENGINE === '1' ? localMatchEngine : serverMatchEngine
