// Emit the initial admin-import CSV for the LaLiga catalog. Run:
//   npm run export:cards:csv
// Produces the same 518 cards as the migration, in the exact column shape the
// in-app admin importer (src/cards/csv.ts) expects — so importing it reproduces
// the catalog. Offline; no credentials.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Card, Rarity } from '../../src/lib/types'
import { cardsToCsv } from '../../src/cards/csv'
import { buildRows, type TmLeague } from './rows'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const OUT_FILE = join(HERE, 'data', 'laliga-2025-cards.csv')

const league: TmLeague = JSON.parse(readFileSync(join(HERE, 'data', 'laliga-2025.json'), 'utf8'))

const cards: Card[] = buildRows(league).map((r) => ({
  id: r.id,
  name: r.name,
  full_name: r.full_name,
  club: r.club,
  club_slug: r.club_slug,
  nationality: r.nationality,
  birthplace: null,
  birth_date: r.birth_date,
  height_cm: r.height_cm,
  weight_kg: null,
  position: r.position,
  cost: r.cost,
  rarity: r.rarity as Rarity,
  is_starter: false,
  abilities: r.abilities,
  zone_grid: r.zone_grid,
  image_url: r.image_url,
}))

writeFileSync(OUT_FILE, cardsToCsv(cards) + '\n')
console.log(`wrote ${cards.length} cards -> ${OUT_FILE.replace(ROOT + '/', '')}`)
