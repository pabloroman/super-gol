import type { MatchOutcome } from '@/lib/types'
import { requireSupabase } from '@/lib/supabase'

/**
 * The match engine is intentionally pluggable.
 *
 * Right now resolution is a PLACEHOLDER living in the Postgres function
 * `play_match` (supabase/migrations/0003_functions.sql): it turns squad
 * strength into a scoreline with weighted randomness. It runs server-side so
 * results and rewards can't be forged.
 *
 * When the real rules land (the d6 + ability + pitch-zone simulation), we swap
 * the implementation behind this same interface — most likely a Supabase Edge
 * Function sharing a TypeScript engine module — without touching any screen.
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
