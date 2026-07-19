// Emit the admin-import CSV for the LaLiga catalog. Run:
//   npm run export:cards:csv
// Produces the same 518 cards as the local seed (supabase/seed_cards.sql), in the
// exact column shape the in-app admin importer (src/cards/csv.ts) expects — so
// importing it bootstraps or refreshes the catalog on a hosted DB, where the catalog
// is NOT seeded. Offline; no credentials.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Card, Rarity } from '../../src/lib/types'
import { cardsToCsv } from '../../src/cards/csv'
import { buildRows, loadOverrides, type TmLeague } from './rows'
import { STARTER_IDS } from './data/starter-deck'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT_FILE = join(HERE, 'data', 'laliga-2025-cards.csv')

const league: TmLeague = JSON.parse(readFileSync(join(HERE, 'data', 'laliga-2025.json'), 'utf8'))

// Same overlay source as the seed (data/overrides.json) so the CSV and the seed
// can never disagree; empty map → derived fallback inside buildRows.
const overrides = loadOverrides()
const starters = new Set(STARTER_IDS)
const cards: Card[] = buildRows(league, Object.keys(overrides).length ? overrides : undefined).map((r) => ({
  id: r.id,
  name: r.name,
  full_name: r.full_name,
  club: r.club,
  club_slug: r.club_slug,
  nationality: r.nationality,
  birth_date: r.birth_date,
  height_cm: r.height_cm,
  position: r.position,
  cost: r.cost,
  rarity: r.rarity as Rarity,
  is_starter: starters.has(r.id),
  abilities: r.abilities,
  zone_grid: r.zone_grid,
  image_url: r.image_url,
}))

// Carry is_starter (true for the 55 in starter-deck.ts) so a FIRST import into a
// fresh hosted DB sets the starter deck as well as the catalog. admin_upsert_cards
// (0006) applies is_starter only for rows that provide it — so this CSV asserts the
// generated deck, while a hand CSV that omits the column still leaves the deck alone.
writeFileSync(OUT_FILE, cardsToCsv(cards, { includeStarter: true }) + '\n')
console.log(`wrote ${cards.length} cards (${starters.size} starters) -> ${OUT_FILE.replace(ROOT + '/', '')}`)
