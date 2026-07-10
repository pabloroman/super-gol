import type { AbilityKey } from '@/lib/types'

/**
 * Display order and Spanish labels for the Super Gol ratings. Labels use the
 * rulebook terminology (docs/rulebook) — the Spanish term always leads.
 */
export const ABILITY_META: Record<AbilityKey, { abbr: string; label: string }> = {
  rb: { abbr: 'RB', label: 'Robo balón' },
  a: { abbr: 'A', label: 'Anticipación' },
  rc: { abbr: 'RC', label: 'Remate cabeza' },
  d: { abbr: 'D', label: 'Desmarque' },
  rg: { abbr: 'RG', label: 'Regate' },
  v: { abbr: 'V', label: 'Velocidad' },
  pc: { abbr: 'PC', label: 'Pase corto' },
  pl: { abbr: 'PL', label: 'Pase largo' },
  pa: { abbr: 'PA', label: 'Pase alto' },
  dl: { abbr: 'DL', label: 'Disparo lejano' },
  rm: { abbr: 'RM', label: 'Remate' },
  // Goalkeeper ratings — only meaningful on the portero card.
  rf: { abbr: 'RF', label: 'Reflejos' },
  co: { abbr: 'CO', label: 'Colocación' },
}

/** Outfield ratings, in card display order. */
export const OUTFIELD_ABILITY_KEYS: AbilityKey[] = [
  'rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm',
]

/** Goalkeeper-only ratings. */
export const KEEPER_ABILITY_KEYS: AbilityKey[] = ['rf', 'co']

/** Full display order: outfield ratings first, keeper ratings grouped last. */
export const ABILITY_ORDER: AbilityKey[] = [
  ...OUTFIELD_ABILITY_KEYS,
  ...KEEPER_ABILITY_KEYS,
]
