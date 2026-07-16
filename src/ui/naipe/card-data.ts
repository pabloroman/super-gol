import type { Card } from '@/lib/types'

/**
 * Formatting for the naipe's data band, matching the printed card:
 * «Julen Guerrero López · Portugalete (Vizcaya) · 07/01/74 - 1,79, 71 kg»
 * (rulebook page 2).
 */

/**
 * Is the player a foreigner? The ficha numeral prints «en rojo si es extranjero»
 * (page 2) — Super Gol is a LaLiga game, so "foreign" means non-Spanish.
 *
 * The two card sources disagree on how they spell nationality: the generated
 * catalog (0005_cards_laliga_2025.sql) uses English exonyms from the
 * Transfermarkt snapshot ('Spain', 'Belgium'), while the hand-decoded originals
 * in supabase/seed.sql use Spanish ('España'). Accept both. An unknown
 * nationality is not evidence of foreignness, so it prints black.
 */
export function isForeign(card: Card): boolean {
  if (!card.nationality) return false
  return !/^(spain|españa|espana)$/i.test(card.nationality.trim())
}

/** `1992-05-11` -> `11/05/92`, the card's date format. */
export function formatBirthDate(iso: string | null): string | null {
  if (!iso) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return null
  const [, year, month, day] = m
  return `${day}/${month}/${year.slice(2)}`
}

/** `180` -> `1,80`, metres with a Spanish decimal comma. */
export function formatHeight(cm: number | null): string | null {
  if (!cm) return null
  return (cm / 100).toFixed(2).replace('.', ',')
}

/** `84` -> `84 kg`. Null across the whole generated catalog today. */
export function formatWeight(kg: number | null): string | null {
  return kg ? `${kg} kg` : null
}

/**
 * The card's third data line: «23/03/68 - 1,87. 84 kg». Built from whatever is
 * present — the generated catalog has birth_date and height but no weight, so
 * this degrades rather than printing empty separators.
 */
export function physicalLine(card: Card): string | null {
  const date = formatBirthDate(card.birth_date)
  const size = [formatHeight(card.height_cm), formatWeight(card.weight_kg)]
    .filter(Boolean)
    .join('. ')
  return [date, size].filter(Boolean).join(' - ') || null
}

/** Age in whole years, for the detail sheet. */
export function ageFrom(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const born = new Date(iso)
  if (Number.isNaN(born.getTime())) return null
  let age = now.getFullYear() - born.getFullYear()
  const monthDiff = now.getMonth() - born.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age--
  return age >= 0 ? age : null
}
