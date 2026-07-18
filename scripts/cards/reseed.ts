// Reseed the hand-editable ability source of truth — scripts/cards/data/abilities.json —
// from the deterministic generator. This is the ONLY writer of that file: after the first
// run it is owned by hand (tweak a card's attributes, then `npm run build:cards` bakes the
// edits into the local seed `seed_cards.sql` and `npm run push:cards` applies them to a live
// DB). Because the core is
// fully deterministic (value follows overall, presence follows position, no randomness),
// re-running yields an empty diff — an accidental reseed can't silently churn hand-edits.
// Run: `npm run reseed:cards`. Offline; no credentials.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Abilities } from '../../src/lib/types'
import { ABILITY_ORDER } from '../../src/game/abilities'
import { buildRows, type TmLeague } from './rows'

const HERE = dirname(fileURLToPath(import.meta.url))
const IN_FILE = join(HERE, 'data', 'laliga-2025.json')
const OUT_FILE = join(HERE, 'data', 'abilities.json')

/** Re-key an abilities blob into rulebook display order so diffs stay stable and readable. */
function ordered(ab: Abilities): Abilities {
  const out: Abilities = {}
  for (const k of ABILITY_ORDER) {
    const v = ab[k]
    if (v != null) out[k] = v
  }
  return out
}

function main() {
  const league: TmLeague = JSON.parse(readFileSync(IN_FILE, 'utf8'))
  const rows = buildRows(league) // pure derive — never read the file we are about to write
  const byId = new Map(rows.map((r) => [r.id, r.abilities]))
  const cards: Record<string, Abilities> = {}
  for (const id of [...byId.keys()].sort()) cards[id] = ordered(byId.get(id)!)
  writeFileSync(OUT_FILE, JSON.stringify({ cards }, null, 2) + '\n')
  console.log(`wrote ${byId.size} card ability sets -> ${OUT_FILE.replace(HERE + '/', '')}`)
}

main()
