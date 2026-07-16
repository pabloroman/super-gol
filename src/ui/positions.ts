import type { PositionGroup } from '@/cards/positions'

/**
 * Spanish display vocabulary for the position groups. The `cards.position`
 * column stores the English group codes the catalog pipeline emits
 * (GK/DF/MF/FW), but the UI is Spanish-only and the rulebook terminology leads —
 * so nothing user-facing should ever print the stored code.
 */

export const POSITION_ABBR: Record<PositionGroup, string> = {
  GK: 'POR',
  DF: 'DEF',
  MF: 'MED',
  FW: 'DEL',
}

export const POSITION_LABEL: Record<PositionGroup, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Medio',
  FW: 'Delantero',
}

/** Board order: keeper first, then out towards the opposition goal. */
export const POSITION_ORDER: PositionGroup[] = ['GK', 'DF', 'MF', 'FW']

export function isPositionGroup(value: string | null | undefined): value is PositionGroup {
  return !!value && value in POSITION_ABBR
}

/** `'GK'` -> `'POR'`; anything unrecognised passes through unchanged. */
export function positionAbbr(position: string | null | undefined): string | null {
  if (!position) return null
  return isPositionGroup(position) ? POSITION_ABBR[position] : position
}

export function positionLabel(position: string | null | undefined): string | null {
  if (!position) return null
  return isPositionGroup(position) ? POSITION_LABEL[position] : position
}

/** Sort index for grouping a squad keeper-first; unknown positions sort last. */
export function positionRank(position: string | null | undefined): number {
  if (!isPositionGroup(position)) return POSITION_ORDER.length
  return POSITION_ORDER.indexOf(position)
}
