import type { Rng } from './rng'
import type { Difficulty } from '@/game/engine'
import type { EngineCard, EngineSquad } from './types'
import type { Abilities, AbilityKey } from '@/lib/types'

/** AI opponent names, matching the placeholder `play_match` opponents. */
export const OPPONENT_NAMES: Record<Difficulty, string> = {
  easy: 'CF Domingueros',
  normal: 'Atlético Medio',
  hard: 'Real Elite CF',
}

/** Mean rating per difficulty on the seed's ~1–3 scale (clamped to 0..RATING_MAX). */
const RATING_MEAN: Record<Difficulty, number> = {
  easy: 1,
  normal: 2,
  hard: 3,
}

const RATING_MAX = 5

const OUTFIELD_KEYS: AbilityKey[] = [
  'rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm',
]

/** Sample a rating around the difficulty mean (triangular-ish, clamped). */
function sampleRating(rng: Rng, mean: number): number {
  // Average of two draws in [mean-1, mean+1] → a gentle central tendency.
  const draw = () => mean - 1 + rng.next() * 2
  const v = Math.round((draw() + draw()) / 2)
  return Math.max(0, Math.min(RATING_MAX, v))
}

function outfieldAbilities(rng: Rng, mean: number): Abilities {
  const a: Abilities = {}
  for (const k of OUTFIELD_KEYS) a[k] = sampleRating(rng, mean)
  return a
}

function keeperAbilities(rng: Rng, mean: number): Abilities {
  return { rf: sampleRating(rng, mean), co: sampleRating(rng, mean) }
}

/**
 * Generate a full opponent squad (10 outfield + 1 keeper) scaled by difficulty.
 * Uses the shared `Rng` so opponents are reproducible from the match seed.
 */
export function generateOpponent(difficulty: Difficulty, rng: Rng): EngineSquad {
  const mean = RATING_MEAN[difficulty]
  const outfield: EngineCard[] = []
  for (let i = 0; i < 10; i++) {
    outfield.push({
      id: `ai-${difficulty}-${i}`,
      name: `Rival ${i + 1}`,
      position: null,
      abilities: outfieldAbilities(rng, mean),
    })
  }
  const keeper: EngineCard = {
    id: `ai-${difficulty}-gk`,
    name: 'Portero rival',
    position: 'GK',
    abilities: keeperAbilities(rng, mean),
  }
  return { name: OPPONENT_NAMES[difficulty], outfield, keeper }
}
