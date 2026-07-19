# Vendored source data

Snapshots from the [virtua-fc](https://github.com/pabloroman/virtua-fc) project,
committed so `npm run build:cards` is reproducible and offline.

| File | Source (virtua-fc `main`) | Notes |
| --- | --- | --- |
| `laliga-2025.json` | `data/2025/ESP1/teams.json` | 2025/26 LaLiga clubs + rosters (Transfermarkt). Verbatim. |
| `sofascore-ids.json` | `data/2025/sofascore_ids.json` | Transfermarkt id → SofaScore id; the SofaScore id keys the virtua-fc CDN portrait (`assets.virtuafc.com/players/{id}.webp`). Committed **pruned** to just the players in `laliga-2025.json`; `build:cards` does the pruning (the upstream file is ~2 MB / 83k entries). |

## Refreshing for a new season / squad update

1. Re-download `teams.json` over `laliga-2025.json`.
2. Overwrite `sofascore-ids.json` with the **full** upstream `sofascore_ids.json`
   (all ~83k entries — no manual pruning needed).
3. `npm run build:cards` (offline; regenerates the catalog seed). It prunes
   `sofascore-ids.json` in place, dropping every id not in the current roster, so
   commit the trimmed file it leaves behind.

Players absent from `sofascore-ids.json` simply get no photo (null `image_url`,
silhouette in the UI) — safe to leave, top up the map later.
