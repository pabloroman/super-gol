// Domain types — mirror the Supabase schema (supabase/migrations/0001_schema.sql).

export type Rarity = 'comun' | 'frecuente' | 'rara'
export type MatchResultKind = 'win' | 'loss' | 'draw'

export type AbilityKey =
  | 'rb' | 'a' | 'rc' | 'd' | 'rg' | 'v' | 'pc' | 'pl' | 'pa' | 'dl'

export type Abilities = Record<AbilityKey, number>

export interface Card {
  id: string
  name: string
  full_name: string | null
  club: string | null
  club_slug: string | null
  nationality: string | null
  birthplace: string | null
  birth_date: string | null
  height_cm: number | null
  weight_kg: number | null
  position: string | null
  cost: number
  rarity: Rarity
  is_starter: boolean
  abilities: Abilities
  zone_grid: boolean[][]
  image_url: string | null
}

export interface Profile {
  id: string
  username: string | null
  coins: number
}

export interface CollectionEntry {
  card: Card
  quantity: number
}

export interface Pack {
  id: string
  name: string
  description: string | null
  price: number
  card_count: number
  rarity_weights: Record<string, number>
  sort_order: number
}

export interface SquadSlot {
  card_id: string
  slot: number
  is_starter: boolean
}

export interface Squad {
  id: number
  name: string
  formation: string
  total_cost: number
  slots: SquadSlot[]
}

export interface MatchEvent {
  minute: number
  side: 'home' | 'away'
  text: string
}

export interface MatchOutcome {
  result: MatchResultKind
  opponent: string
  goals_for: number
  goals_against: number
  coins_awarded: number
  log: MatchEvent[]
}
