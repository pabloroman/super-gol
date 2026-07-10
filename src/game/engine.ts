import type { MatchOutcome } from '@/lib/types'
import { requireSupabase } from '@/lib/supabase'
import { fetchActiveSquad, fetchCatalog } from '@/data/api'
import { simulateMatch } from '@/game/engine/index'
import { buildEngineSquad } from '@/game/engine/squad'
import { generateOpponent } from '@/game/engine/opponent'
import { createRng, seedFrom } from '@/game/engine/rng'
import type { Difficulty } from '@/game/engine/types'

// The engine's `Difficulty` lives inside the pure module (src/game/engine/types.ts)
// so the whole engine stays Edge-Function-portable. Re-export it here because this
// is the screen-facing entry point most UI code imports difficulty from.
export type { Difficulty }

/**
 * The match engine is intentionally pluggable.
 *
 * `serverMatchEngine` is the AUTHORITATIVE path: it invokes the `play-match`
 * Supabase Edge Function (supabase/functions/play-match/), which runs the exact
 * same pure rules module from `src/game/engine/` and then commits the result +
 * coins through the `record_match` SECURITY DEFINER function — a path the client
 * can call but never forge.
 *
 * `localMatchEngine` runs those same REAL basic-game rules (the seeded d6 +
 * ability + marcaje simulation) entirely on the client. Because the client can't
 * be trusted with coins, it is NOT the default — it exists only so the rules
 * engine is previewable without a deployed Edge Function (`VITE_LOCAL_ENGINE=1`).
 */
export interface MatchEngine {
  play(difficulty: Difficulty): Promise<MatchOutcome>
}

export const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Amistoso', blurb: 'Rival flojo. Ideal para empezar.' },
  { id: 'normal', label: 'Liga', blurb: 'Un rival de mitad de tabla.' },
  { id: 'hard', label: 'Champions', blurb: 'Los mejores. Más recompensa.' },
]

/** Authoritative engine: delegates to the `play-match` Edge Function. */
export const serverMatchEngine: MatchEngine = {
  async play(difficulty: Difficulty): Promise<MatchOutcome> {
    const { data, error } = await requireSupabase().functions.invoke('play-match', {
      body: { p_difficulty: difficulty },
    })
    if (error) throw new Error(error.message)
    return data as MatchOutcome
  },
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
    const home = buildEngineSquad(squad.name || 'Tu equipo', squad, catalog)
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
