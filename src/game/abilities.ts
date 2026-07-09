import type { AbilityKey } from '@/lib/types'

/** Display order and Spanish labels for the ten Super Gol ratings. */
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
}

export const ABILITY_ORDER: AbilityKey[] = ['rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl']
