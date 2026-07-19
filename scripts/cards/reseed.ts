// Reseed the hand-editable overlay source of truth — scripts/cards/data/overrides.json —
// from the deterministic generator. Each entry is `{ label, abilities }`: a descriptive
// name·club label (ignored by the build; it keeps the opaque {tmId}-{season} keys readable)
// plus the derived ability core. This is the ONLY writer of that file: after the first run it
// is owned by hand (tweak abilities or add any card field, then `npm run build:cards` bakes the
// edits into the local seed `seed_cards.sql` and `npm run push:cards` applies the abilities to a
// live DB). Because the core is fully deterministic (value follows overall, presence follows
// position, no randomness), re-running yields an empty diff — an accidental reseed can't silently
// churn hand-edits. Run: `npm run reseed:cards`. Offline; no credentials.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Abilities } from '../../src/lib/types'
import { ABILITY_ORDER } from '../../src/game/abilities'
import { buildRows, type TmLeague } from './rows'

const HERE = dirname(fileURLToPath(import.meta.url))
const IN_FILE = join(HERE, 'data', 'laliga-2025.json')
const OUT_FILE = join(HERE, 'data', 'overrides.json')

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
  const byId = new Map(rows.map((r) => [r.id, r]))
  const cards: Record<string, { label: string; abilities: Abilities }> = {}
  for (const id of [...byId.keys()].sort()) {
    const r = byId.get(id)!
    cards[id] = { label: `${r.full_name} · ${r.club}`, abilities: ordered(r.abilities) }
  }
  writeFileSync(OUT_FILE, JSON.stringify({ cards }, null, 2) + '\n')
  console.log(`wrote ${byId.size} card overlays -> ${OUT_FILE.replace(HERE + '/', '')}`)
}

main()
