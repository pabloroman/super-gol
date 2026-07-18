import type { Card } from '@/lib/types'
import { ZONE_GRIDS } from '@/cards/positions'

/**
 * Three real LaLiga cards for the landing hero, one per big club so the crests
 * differ. The values are lifted verbatim from the generated catalog
 * (`supabase/migrations/0005_cards_laliga_2025.sql`) so the naipe renders exactly
 * as it does in-app — photo via `image_url`, crest via `crestUrl(club_slug)`.
 * Purely decorative; if a photo 404s the naipe falls back to the player initial.
 */
export const SAMPLE_CARDS: Card[] = [
  {
    id: 'jude-bellingham-rma-2526',
    name: 'BELLINGHAM',
    full_name: 'Jude Bellingham',
    club: 'Real Madrid',
    club_slug: 'rma',
    nationality: 'England',
    birthplace: null,
    birth_date: '2003-06-29',
    height_cm: 186,
    weight_kg: null,
    position: 'MF',
    cost: 10,
    rarity: 'rara',
    is_starter: false,
    abilities: { rb: 1, a: 1, rc: 1, d: 2, rg: 3, v: 1, pc: 3, pl: 3, pa: 1, dl: 3, rm: 1 },
    zone_grid: ZONE_GRIDS.MF,
    image_url: 'https://assets.virtuafc.com/players/991011.webp',
  },
  {
    id: 'lamine-yamal-fcb-2526',
    name: 'YAMAL',
    full_name: 'Lamine Yamal',
    club: 'FC Barcelona',
    club_slug: 'fcb',
    nationality: 'Spain',
    birthplace: null,
    birth_date: '2007-07-13',
    height_cm: 180,
    weight_kg: null,
    position: 'FW',
    cost: 9,
    rarity: 'rara',
    is_starter: false,
    abilities: { rb: 1, a: 1, rc: 1, d: 3, rg: 3, v: 3, pc: 2, pl: 1, pa: 1, dl: 1, rm: 2 },
    zone_grid: ZONE_GRIDS.FW,
    image_url: 'https://assets.virtuafc.com/players/1402912.webp',
  },
  {
    id: 'antoine-griezmann-atm-2526',
    name: 'GRIEZMANN',
    full_name: 'Antoine Griezmann',
    club: 'Atlético de Madrid',
    club_slug: 'atm',
    nationality: 'France',
    birthplace: null,
    birth_date: '1991-03-21',
    height_cm: 176,
    weight_kg: null,
    position: 'FW',
    cost: 8,
    rarity: 'frecuente',
    is_starter: false,
    abilities: { rb: 1, a: 1, rc: 1, d: 3, rg: 2, v: 1, pc: 2, pl: 1, pa: 1, dl: 2, rm: 3 },
    zone_grid: ZONE_GRIDS.FW,
    image_url: 'https://assets.virtuafc.com/players/85859.webp',
  },
]
