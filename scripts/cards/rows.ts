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
 * A hand-authored overlay entry: any subset of a card's fields, shallow-merged over
 * the derived row (see `buildRows`). `abilities`, when present, replaces the derived
 * set wholesale. `label` is descriptive only (name · club) and is ignored by the
 * merge — it exists to keep the opaque `{tmId}-{season}` keys navigable while hand-
 * editing. Overriding `position` or `club` does NOT re-derive `zone_grid` /
 * `club_slug`; set those alongside if you need them to change too.
 */
export interface CardOverride {
  label?: string
  abilities?: Abilities
  name?: string
  full_name?: string
  club?: string
  club_slug?: string
  nationality?: string | null
  birth_date?: string | null
  height_cm?: number | null
  position?: string
  cost?: number
  rarity?: string
  zone_grid?: boolean[][]
  image_url?: string | null
}

/**
 * The hand-editable overlay source of truth: `data/overrides.json`, keyed by the
 * card row id (see `buildRows`). Bootstrapped by `reseed.ts`, then owned by hand.
 * Both emitters (SQL seed + admin CSV) load it through here so they can never drift.
 * Returns `{}` when the file is absent (e.g. before the first reseed), in which case
 * callers fall back to freshly-derived cards.
 */
export function loadOverrides(): Record<string, CardOverride> {
  const file = join(DATA_DIR, 'overrides.json')
  if (!existsSync(file)) return {}
  const parsed = JSON.parse(readFileSync(file, 'utf8')) as { cards?: Record<string, CardOverride> }
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
 * Turn the snapshot into card rows. When `overridesById` is given, each card's
 * derived row is shallow-merged with its hand-authored overlay from that map (the
 * hand-edited `overrides.json`): `abilities` replaces the derived set wholesale,
 * every other present field overwrites its derived value, and `label` is ignored.
 * An id absent from the map falls back to the pure derived row and is reported via
 * `onMissing`. Everything not overridden (cost, rarity, position group, zone grid,
 * photo) stays derived from the snapshot. Call with no map (reseed, tests) for a
 * pure derive.
 */
export function buildRows(
  league: TmLeague,
  overridesById?: Record<string, CardOverride>,
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

      // Stable id: the Transfermarkt id (unique per snapshot) + season, so a re-pull
      // updates a card in place instead of forking it when a name or club changes. A
      // duplicate is a snapshot data error, not something to paper over silently.
      const id = `${p.id}-${SEASON_TAG}`
      if (seen.has(id)) throw new Error(`duplicate card id ${id} (Transfermarkt id ${p.id})`)
      seen.add(id)

      const row: CardRow = {
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
        abilities: derived.abilities,
        zone_grid: derived.zone_grid,
        image_url: photoUrl(p.id),
      }

      const override = overridesById?.[id]
      if (overridesById && !override) onMissing?.(id)
      rows.push(override ? applyOverride(row, override) : row)
    }
  }
  return rows
}

/**
 * Shallow-merge a hand-authored overlay over a derived row. `label` is descriptive
 * only (see `CardOverride`) and never lands on the row; every other present field
 * overwrites — `abilities` as a whole object, so it replaces the derived set.
 */
function applyOverride(row: CardRow, override: CardOverride): CardRow {
  const { label: _label, ...fields } = override
  return { ...row, ...fields }
}
