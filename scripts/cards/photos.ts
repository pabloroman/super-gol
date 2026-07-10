// Player photos: virtua-fc already mirrors portraits on its own public CDN,
// keyed by SofaScore id — assets.virtuafc.com/players/{sofascoreId}.webp.
//
// virtua-fc's data/2025/sofascore_ids.json maps Transfermarkt id -> SofaScore
// id, so we resolve a player's card image straight to that stable CDN URL. It's
// the project's own asset host (identical on every environment), so the absolute
// URL is baked directly into the catalog — no self-hosting, upload, or per-
// project rewriting. Players with no SofaScore mapping get a null image_url and
// the UI falls back to a silhouette.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))

const CDN_BASE = 'https://assets.virtuafc.com/players'

let idMap: Record<string, string> | null = null
function sofascoreMap(): Record<string, string> {
  if (!idMap) idMap = JSON.parse(readFileSync(join(HERE, 'data', 'sofascore-ids.json'), 'utf8'))
  return idMap!
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
