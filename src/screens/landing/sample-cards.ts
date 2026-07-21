import type { Card } from '@/lib/types'
import { ZONE_GRIDS } from '@/cards/positions'

/**
 * Static fallback for the landing hero fan — three real LaLiga cards, one per big
 * club so the crests differ. `useShowcaseCards` normally shows a live, rotating
 * trio from the catalog; these render instantly on first paint and stand in when
 * the fetch fails or is offline. Values are lifted verbatim from the generated
 * catalog (`supabase/seed_cards.sql`) so the naipe renders exactly as in-app —
 * photo via `image_url`, crest via `crestUrl(club_slug)`. Being a hand copy, this
 * can drift from the catalog; keep it in sync when re-vendoring a season (the
 * durable fix is to generate it from the `build:cards` pipeline). Purely
 * decorative; if a photo 404s the naipe falls back to the player initial.
 */
export const SAMPLE_CARDS: Card[] = [
  {
    id: '581678-2526',
    name: 'BELLINGHAM',
    full_name: 'Jude Bellingham',
    club: 'Real Madrid',
    club_slug: 'rma',
    nationality: 'England',
    birth_date: '2003-06-29',
    height_cm: 186,
    position: 'MF',
    cost: 10,
    rarity: 'rara',
    is_starter: false,
    abilities: { d: 2, rg: 3, pc: 3, pl: 3, dl: 3 },
    zone_grid: ZONE_GRIDS.MF,
    image_url: 'https://assets.virtuafc.com/players/991011.webp',
  },
  {
    id: '411295-2526',
    name: 'RAPHINHA',
    full_name: 'Raphinha',
    club: 'FC Barcelona',
    club_slug: 'fcb',
    nationality: 'Brazil',
    birth_date: '1996-12-14',
    height_cm: 176,
    position: 'FW',
    cost: 10,
    rarity: 'rara',
    is_starter: false,
    abilities: { d: 3, rg: 3, v: 3, pc: 2, rm: 2 },
    zone_grid: ZONE_GRIDS.FW,
    image_url: 'https://assets.virtuafc.com/players/831005.webp',
  },
  {
    id: '844637-2526',
    name: 'PUBILL',
    full_name: 'Marc Pubill',
    club: 'Atlético de Madrid',
    club_slug: 'atm',
    nationality: 'Spain',
    birth_date: '2003-06-20',
    height_cm: 190,
    position: 'DF',
    cost: 8,
    rarity: 'frecuente',
    is_starter: false,
    abilities: { rb: 3, a: 3, rc: 2, pl: 2, pa: 2 },
    zone_grid: ZONE_GRIDS.DF,
    image_url: 'https://assets.virtuafc.com/players/1094106.webp',
  },
]
