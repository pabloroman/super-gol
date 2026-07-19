// CSV <-> Card mapping for the admin importer and the offline catalog export.
//
// The CSV carries finished card fields (no inference): one column per scalar
// field plus one column per ability key. A card whose `zone_grid` differs from its
// coarse position default (ZONE_GRIDS[GK/DF/MF/FW]) gets an explicit `zone_grid` JSON
// column; a card left at the group default omits it. Since demarcaciones are now
// per-position (a left-back's grid ≠ the DF-group default), most catalog rows carry the
// explicit column — the coarse `position` can't reconstruct the granular grid, so it
// must travel in the file. parse and serialize are symmetric — a round trip is loss-free.

import Papa from 'papaparse'
import type { Abilities, AbilityKey, Card, Rarity } from '../lib/types'
import { ZONE_GRIDS, type PositionGroup } from './positions'

const ABILITY_KEYS: AbilityKey[] = [
  'rb', 'a', 'rc', 'd', 'rg', 'v', 'pc', 'pl', 'pa', 'dl', 'rm', 'rf', 'co',
]
const SCALAR_COLUMNS = [
  'id', 'name', 'full_name', 'club', 'club_slug', 'nationality',
  'birth_date', 'height_cm', 'position', 'cost', 'rarity',
  'is_starter', 'image_url',
] as const
const RARITIES: Rarity[] = ['comun', 'frecuente', 'rara']
const POSITIONS: PositionGroup[] = ['GK', 'DF', 'MF', 'FW']

const gridKey = (g: boolean[][]): string => JSON.stringify(g)
const defaultGrid = (pos: string): boolean[][] => ZONE_GRIDS[pos as PositionGroup] ?? []
const isDefaultGrid = (c: Card): boolean =>
  gridKey(c.zone_grid ?? []) === gridKey(defaultGrid(c.position ?? ''))

// A card parsed from a CSV that may omit the is_starter column. When the column
// is absent, is_starter is left undefined so the importer preserves whatever the
// DB already has (the starter deck is owned by a migration, not the catalog CSV).
// A Card is assignable to this, so callers can pass either shape to the upsert.
export type ImportedCard = Omit<Card, 'is_starter'> & { is_starter?: boolean }

export interface ParseResult {
  cards: ImportedCard[]
  errors: string[]
}

function intOrNull(raw: string | undefined): number | null {
  const s = (raw ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n) : null
}

function boolCell(raw: string | undefined): boolean {
  return /^(true|1|yes|y)$/i.test((raw ?? '').trim())
}

/** Parse an admin CSV into Cards. Invalid rows are skipped and reported in `errors`. */
export function parseCardsCsv(text: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })
  const errors: string[] = parsed.errors.map((e) => `row ${e.row ?? '?'}: ${e.message}`)
  const cards: ImportedCard[] = []
  // When the file has no is_starter column, leave it unset so the importer keeps
  // the DB's existing flag rather than resetting the starter deck.
  const hasStarterColumn = (parsed.meta.fields ?? []).includes('is_starter')

  parsed.data.forEach((row, i) => {
    const line = i + 2 // 1-based, +1 for the header row
    const id = (row.id ?? '').trim()
    const name = (row.name ?? '').trim()
    if (!id) return errors.push(`row ${line}: missing id`)
    if (!name) return errors.push(`row ${line}: missing name (${id})`)

    const rarity = ((row.rarity ?? '').trim() || 'comun') as Rarity
    if (!RARITIES.includes(rarity)) return errors.push(`row ${line}: bad rarity "${row.rarity}" (${id})`)

    const position = (row.position ?? '').trim()
    if (position && !POSITIONS.includes(position as PositionGroup))
      return errors.push(`row ${line}: bad position "${position}" (${id})`)

    const cost = intOrNull(row.cost) ?? 0
    if (cost < 0) return errors.push(`row ${line}: negative cost (${id})`)

    const abilities: Abilities = {}
    for (const k of ABILITY_KEYS) {
      const v = intOrNull(row[k])
      if (v != null) {
        if (v < 0 || v > 3) return errors.push(`row ${line}: ${k}=${v} out of range 0..3 (${id})`)
        if (v !== 0) abilities[k] = v
      }
    }

    let zone_grid: boolean[][]
    const rawGrid = (row.zone_grid ?? '').trim()
    if (rawGrid) {
      try {
        zone_grid = JSON.parse(rawGrid)
      } catch {
        return errors.push(`row ${line}: unparseable zone_grid (${id})`)
      }
    } else {
      zone_grid = defaultGrid(position)
    }

    const card: ImportedCard = {
      id,
      name,
      full_name: (row.full_name ?? '').trim() || null,
      club: (row.club ?? '').trim() || null,
      club_slug: (row.club_slug ?? '').trim() || null,
      nationality: (row.nationality ?? '').trim() || null,
      birth_date: (row.birth_date ?? '').trim() || null,
      height_cm: intOrNull(row.height_cm),
      position: position || null,
      cost,
      rarity,
      abilities,
      zone_grid,
      image_url: (row.image_url ?? '').trim() || null,
    }
    if (hasStarterColumn) card.is_starter = boolCell(row.is_starter)
    cards.push(card)
  })

  return { cards, errors }
}

/**
 * Serialize Cards to an admin CSV. Emits a `zone_grid` column only when some
 * card deviates from its position default.
 *
 * `includeStarter` (default true) controls the is_starter column. Pass false for
 * a catalog export that should be starter-agnostic — the offline seed CSV — so
 * re-importing it never disturbs the migration-owned starter deck. The in-app
 * admin export keeps it true, so a full export→edit→import round trip preserves
 * each card's real flag.
 */
export function cardsToCsv(cards: Card[], opts: { includeStarter?: boolean } = {}): string {
  const includeStarter = opts.includeStarter ?? true
  const needsGrid = cards.some((c) => !isDefaultGrid(c))
  const scalarColumns = includeStarter
    ? SCALAR_COLUMNS
    : SCALAR_COLUMNS.filter((col) => col !== 'is_starter')
  const columns = [...scalarColumns, ...ABILITY_KEYS, ...(needsGrid ? ['zone_grid'] : [])]

  const rows = cards.map((c) => {
    const row: Record<string, string> = {
      id: c.id,
      name: c.name,
      full_name: c.full_name ?? '',
      club: c.club ?? '',
      club_slug: c.club_slug ?? '',
      nationality: c.nationality ?? '',
      birth_date: c.birth_date ?? '',
      height_cm: c.height_cm == null ? '' : String(c.height_cm),
      position: c.position ?? '',
      cost: String(c.cost),
      rarity: c.rarity,
      is_starter: c.is_starter ? 'true' : 'false',
      image_url: c.image_url ?? '',
    }
    for (const k of ABILITY_KEYS) row[k] = c.abilities[k] == null ? '' : String(c.abilities[k])
    if (needsGrid) row.zone_grid = isDefaultGrid(c) ? '' : JSON.stringify(c.zone_grid)
    return row
  })

  return Papa.unparse({ fields: columns, data: rows }, { newline: '\n' })
}
