// Shared row builder: turn the vendored LaLiga snapshot into card rows. Used by
// build.ts (emits the SQL migration) and export-csv.ts (emits the admin CSV), so
// the two artifacts can never drift.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Abilities } from '../../src/lib/types'
import { ageAt, marketValueToOverall, parseMarketValue } from '../../src/cards/valuation'
import { deriveCard } from '../../src/cards/factors'
import { clubSlug } from '../../src/cards/clubs'
import { photoUrl } from './photos'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data')

/**
 * The hand-editable ability source of truth: `data/abilities.json`, keyed by the
 * card row id (see `buildRows`). Written by `reseed.ts`, then owned by hand. Both
 * emitters (SQL migration + admin CSV) load it through here so they can never
 * drift. Returns `{}` when the file is absent (e.g. before the first reseed), in
 * which case callers fall back to freshly-derived abilities.
 */
export function loadAbilities(): Record<string, Abilities> {
  const file = join(DATA_DIR, 'abilities.json')
  if (!existsSync(file)) return {}
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { cards?: Record<string, Abilities> }
  return parsed.cards ?? {}
}

export const SEASON_TAG = '2526'

export interface TmPlayer {
  id: string
  name: string
  position: string
  nationality?: string[]
  dateOfBirth?: string
  height?: string
  marketValue?: string
}
export interface TmClub {
  name: string
  players: TmPlayer[]
}
export interface TmLeague {
  clubs: TmClub[]
}

export interface CardRow {
  id: string
  name: string
  full_name: string
  club: string
  club_slug: string
  nationality: string | null
  birth_date: string | null
  height_cm: number | null
  position: string
  cost: number
  rarity: string
  abilities: Abilities
  zone_grid: boolean[][]
  image_url: string | null
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/** Display surname: last whitespace-separated token, uppercased. */
function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] || fullName).toUpperCase()
}

function parseHeightCm(height: string | undefined): number | null {
  if (!height) return null
  const m = height.replace(',', '.').match(/([\d.]+)/)
  if (!m) return null
  const meters = parseFloat(m[1])
  return isFinite(meters) ? Math.round(meters * 100) : null
}

function parseBirthDate(dob: string | undefined): string | null {
  if (!dob) return null
  const d = new Date(dob)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

/**
 * Turn the snapshot into card rows. When `abilitiesById` is given, a card's
 * abilities come from that map (the hand-edited `abilities.json`); an id absent
 * from the map falls back to freshly-derived abilities and is reported via
 * `onMissing`. Everything else (cost, rarity, position group, zone grid, photo)
 * is always derived from the snapshot. Call with no map (reseed, tests) for a
 * pure derive.
 */
export function buildRows(
  league: TmLeague,
  abilitiesById?: Record<string, Abilities>,
  onMissing?: (id: string) => void,
): CardRow[] {
  const rows: CardRow[] = []
  const seen = new Set<string>()
  for (const club of league.clubs) {
    const slug = clubSlug(club.name)
    for (const p of club.players ?? []) {
      const isGk = /goal|keeper/i.test(p.position)
      const overall = marketValueToOverall(
        parseMarketValue(p.marketValue),
        ageAt(p.dateOfBirth),
        isGk,
      )
      const derived = deriveCard(p.position, overall)

      let id = `${slugify(p.name)}-${slug}-${SEASON_TAG}`
      if (seen.has(id)) id = `${id}-${p.id}`
      seen.add(id)

      let abilities = derived.abilities
      if (abilitiesById) {
        const override = abilitiesById[id]
        if (override) abilities = override
        else onMissing?.(id)
      }

      rows.push({
        id,
        name: surname(p.name),
        full_name: p.name,
        club: club.name,
        club_slug: slug,
        nationality: p.nationality?.[0] ?? null,
        birth_date: parseBirthDate(p.dateOfBirth),
        height_cm: parseHeightCm(p.height),
        position: derived.position,
        cost: derived.cost,
        rarity: derived.rarity,
        abilities,
        zone_grid: derived.zone_grid,
        image_url: photoUrl(p.id),
      })
    }
  }
  return rows
}
