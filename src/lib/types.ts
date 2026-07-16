// Domain types — mirror the Supabase schema (supabase/migrations/0001_schema.sql).

export type Rarity = 'comun' | 'frecuente' | 'rara'
export type MatchResultKind = 'win' | 'loss' | 'draw'

// Ability keys use the Spanish rulebook abbreviations (see docs/rulebook). The
// first ten are the historical outfield ratings; the basic-game engine also
// needs `rm` (remate en el área) and the two goalkeeper ratings `rf` (reflejos)
// and `co` (colocación) — see docs/rulebook/pages/page-10.md and page-11.md.
export type AbilityKey =
  | 'rb' | 'a' | 'rc' | 'd' | 'rg' | 'v' | 'pc' | 'pl' | 'pa' | 'dl'
  | 'rm' | 'rf' | 'co'

// Card ability blobs come from freeform `jsonb`, so a given card may not carry
// every key. A missing rating counts as zero (rulebook page 6) — always read
// through `abilityValue` in src/game/ratings.ts, never index this directly.
export type Abilities = Partial<Record<AbilityKey, number>>

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
  // Demarcación grid, 5 cols × 6 rows (row/col matching the board in
  // src/game/engine/pitch.ts). ADVANCED GAME ONLY: the basic game is played «sin
  // demarcación» (rulebook page 11), so this has NO effect on the match engine — it
  // is derived from `position` and carried for the future advanced game.
  zone_grid: boolean[][]
  image_url: string | null
}

export interface Profile {
  id: string
  username: string | null
  coins: number
  is_admin: boolean
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

// Structured chronicle vocabulary. The engine emits these so the crónica can be
// re-rendered in another language later; `text` holds the Spanish rendering and
// stays populated for back-compat with screens that read it directly.
export type MatchEventType =
  | 'kickoff'
  | 'pass'
  | 'dribble'
  | 'shot'
  | 'interception'
  | 'steal'
  | 'save'
  | 'goal'
  | 'turnover'
  | 'fulltime'

export interface MatchEventParams {
  player?: string
  target?: string
  ability?: AbilityKey
  dice?: number[]
  total?: number
  success?: boolean
  marcaje?: string
  // Absolute board coordinates of the ball carrier when the event fired (col 0–4,
  // row 0–5; home defends row 0). Lets the crónica be replayed on the visual pitch.
  cell?: { col: number; row: number }
}

export interface MatchEvent {
  minute: number
  side: 'home' | 'away'
  text: string
  type?: MatchEventType
  params?: MatchEventParams
}

export interface MatchOutcome {
  result: MatchResultKind
  opponent: string
  goals_for: number
  goals_against: number
  coins_awarded: number
  log: MatchEvent[]
}
