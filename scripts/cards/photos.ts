// Player photos: virtua-fc already mirrors portraits on its own public CDN,
// keyed by SofaScore id — assets.virtuafc.com/players/{sofascoreId}.webp.
//
// virtua-fc's data/2025/sofascore_ids.json maps Transfermarkt id -> SofaScore
// id, so we resolve a player's card image straight to that stable CDN URL. It's
// the project's own asset host (identical on every environment), so the absolute
// URL is baked directly into the catalog — no self-hosting, upload, or per-
// project rewriting. Players with no SofaScore mapping get a null image_url and
// the UI falls back to a silhouette.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

const CDN_BASE = 'https://assets.virtuafc.com/players'

// The Transfermarkt id -> SofaScore id map. It is committed pruned to just the current
// roster; a refresh overwrites it with the full upstream map (~83k entries) and
// build:cards prunes it back in place via prunePhotoMap. See data/README.md.
const MAP_FILE = join(HERE, 'data', 'sofascore-ids.json')

let idMap: Record<string, string> | null = null
function sofascoreMap(): Record<string, string> {
  if (!idMap) idMap = JSON.parse(readFileSync(MAP_FILE, 'utf8'))
  return idMap!
}

/**
 * Prune sofascore-ids.json in place, dropping every Transfermarkt id not in the current
 * roster. build:cards calls this before deriving rows, so overwriting the file with the
 * full upstream map and rebuilding trims it back to the players we actually ship. Order
 * is preserved for a stable diff; idempotent (a second run removes nothing). Returns the
 * kept/removed counts.
 */
export function prunePhotoMap(transfermarktIds: Iterable<string>): { kept: number; removed: number } {
  const full = JSON.parse(readFileSync(MAP_FILE, 'utf8')) as Record<string, string>
  const wanted = new Set<string>()
  for (const id of transfermarktIds) wanted.add(String(id))
  const pruned: Record<string, string> = {}
  for (const tmId of Object.keys(full)) if (wanted.has(tmId)) pruned[tmId] = full[tmId]
  const removed = Object.keys(full).length - Object.keys(pruned).length
  if (removed > 0) writeFileSync(MAP_FILE, JSON.stringify(pruned) + '\n')
  idMap = pruned // refresh the memoized map for photoUrl() calls later in this same run
  return { kept: Object.keys(pruned).length, removed }
}

/** SofaScore id for a Transfermarkt id, or null when unmapped. */
export function sofascoreId(transfermarktId: string): string | null {
  return sofascoreMap()[transfermarktId] ?? null
}

/**
 * The card image_url for a player: the virtua-fc CDN portrait URL when the
 * player has a SofaScore mapping, null otherwise. Pure — no network I/O.
 */
export function photoUrl(transfermarktId: string): string | null {
  const sofaId = sofascoreId(transfermarktId)
  return sofaId ? `${CDN_BASE}/${sofaId}.webp` : null
}
