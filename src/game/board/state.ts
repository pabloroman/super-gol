/**
 * Serializable board state for the interactive basic game.
 *
 * This is the model the abstract `src/game/engine/loop.ts` never had: all 22 cards
 * standing on the 5×6 board (plus the two portería cells), with marcaje DERIVED from
 * where they stand rather than rolled for. Everything here is plain JSON — no closures
 * (the old `Pitch` was one), no object-identity comparisons (the old `carrier === x`
 * was one) — so a match can round-trip through the database between jugadas.
 *
 * Coordinates are absolute and match `ZONE_MAP` in `../engine/pitch.ts`: columns A–E
 * → 0–4, rows 1–6 → 0–5. Home defends row 0 and attacks toward row 5; away the
 * reverse ("se ataca hacia arriba", rulebook page 2). The two goalkeeper cells — the
 * rulebook's "dos [casillas] habilitadas especialmente para los porteros" (page 1) —
 * sit outside the 30 playable squares at row -1 (home's goal) and row 6 (away's).
 *
 * The rulebook worked example (fixtures/worked-example.ts) prints rows 1–6 with white
 * on top; that is this model's home side shifted by one row (row N printed = row N-1
 * here). The Phase 2 golden replay converts at the boundary.
 */

import type { Cell } from '../engine/pitch'
import type { Side, Difficulty, EngineCard } from '../engine/types'

export type { Cell } from '../engine/pitch'
export type { Side, Marcaje, Difficulty, EngineCard } from '../engine/types'

/** The 30 playable squares. The keeper cells (row -1 / row 6) are outside this grid. */
export const COLS = 5
export const ROWS = 6

/** Bumped when the serialized shape changes, so a stale active session can be retired. */
export const STATE_VERSION = 1

/**
 * Match-local player identity. Deliberately NOT the card id: card ids are catalog
 * slugs and nothing stops the human and the generated opponent both fielding the same
 * card (e.g. Zubizarreta), so identity has to be positional. Index 0 is the keeper;
 * 1–10 are the outfield. Home is `h0..h10`, away `a0..a10`.
 */
export type PlayerId = string

/** A card placed on the board. */
export interface MatchPlayer {
  id: PlayerId
  side: Side
  /**
   * A self-contained snapshot of the card (id, name, position, ratings). Embedded
   * rather than referenced so the state needs no external catalog to resolve a
   * jugada — every `apply` reads ratings straight off the player — and so a persisted
   * session survives a later catalog edit unchanged.
   */
  card: EngineCard
  cell: Cell
  /**
   * Stacking (rulebook page 4/13): at most two players share a cell and always from
   * different teams, so exactly one is "encima". `onTop` true = upper half of the
   * cell. Alone in the cell → always false. This flag, read against the opponent's,
   * is what `marcajeOf` turns into MH/MZ — marcaje is emergent, never stored.
   */
  onTop: boolean
}

/**
 * The ball. It sits ON a player almost always; it goes loose (`carrier: null`) only
 * transiently — a pase al hueco in flight, or a failed pass awaiting recovery — and
 * `cell` always tracks where it physically is, so the board can render it either way.
 */
export interface Ball {
  carrier: PlayerId | null
  cell: Cell
}

/**
 * Anti-stall bookkeeping (rulebook page 12, "¡MUY importante!"), scoped to the current
 * possession. Both lists reset the moment the attacker interleaves a non-direct pass,
 * a regate or a remate — the rulebook's own escape hatch. Without this the possession
 * is unbounded, since the basic game's only brake on infinite passing is these two
 * restrictions.
 */
export interface AntiStall {
  /** Players already involved in the current run of pases directos (no repeats). */
  pdChain: PlayerId[]
  /** `player → "col,row"` a player has already been moved to (no moving there twice). */
  movedTo: Record<PlayerId, string[]>
}

/**
 * Who owes an input, and what kind. The basic game is NOT ply-alternating: a turno is
 * a whole possession and the defender acts only in reaction to specific attacker
 * events (page 3/5). Each of those reaction windows — and each mid-jugada micro-choice
 * the rulebook demands — is a phase the machine parks in, so `apply` stays a plain
 * single-step reducer that can suspend to the database between any two jugadas.
 *
 * `side` on every variant is the ONE thing the transport needs to know whose input is
 * due (human vs AI); everything else the phase carries is context for `legalActions`.
 */
export type Phase =
  /** Pre-kickoff (and post-goal) arrangement; `side` is the team still editing. */
  | { kind: 'placement'; side: Side }
  /** The mandatory opening pase directo to an adjacent player (page 12). */
  | { kind: 'kickoff'; side: Side }
  /** The attacker picks a jugada. */
  | { kind: 'attack'; side: Side }
  /** Granted by an attacker movement: the defender may move any one player (page 5). */
  | { kind: 'defend_move'; side: Side }
  /** After a completed PC/PL to a marked receiver: anticipación / robo / decline. */
  | { kind: 'defend_interrupt'; side: Side; receiver: PlayerId }
  /** After a failed robo: the attacker may advance one cell (not a movement) or decline. */
  | { kind: 'robo_advance'; side: Side }
  /** Failed PC/PL with several equal recoverers: the defender chooses (page 7). */
  | { kind: 'recovery_pick'; side: Side; candidates: PlayerId[] }
  /** Loose ball after a pase al hueco: the side that won the roll moves first (page 7/8). */
  | { kind: 'hueco_move'; side: Side }
  /** Before a keeper restart, one player per team may move (page 11). */
  | { kind: 'restart_move'; side: Side }
  /** The keeper puts the ball back in play (page 11). */
  | { kind: 'keeper_restart'; side: Side }
  /** The match is over. */
  | { kind: 'fulltime' }

/**
 * The full match. `turno` counts changes of possession, not plies: the rulebook's
 * tournament clock ends the match "cuando éste [el turno] cambie de los jugadores de
 * un equipo al otro 15 veces" (page 29, verified against the scan). `ply` is a
 * monotonic counter used purely to address the RNG (each roll derives a fresh seed
 * from `seedFrom(seed, ply, tag)`), so it also serves as the optimistic-concurrency
 * token on the persisted session.
 */
export interface MatchState {
  version: number
  players: Record<PlayerId, MatchPlayer>
  ball: Ball
  attacker: Side
  phase: Phase
  /**
   * "Libre de marcaje ... de cara a la siguiente jugada" (page 4): a per-jugada flag a
   * FAILED defensive action grants the carrier, orthogonal to geometry — a player can
   * be physically marked en zona yet legally libre. Holds one id (LIBRE always attaches
   * to whoever holds the ball) and is cleared by the reducer after the next jugada.
   */
  libre: PlayerId | null
  score: { home: number; away: number }
  /** Possession changes so far; the match ends at 15 (page 29). */
  turno: number
  ply: number
  /**
   * Jugadas played in the current possession. A completed pass keeps the ball and does
   * not advance `turno`, and the basic game puts no repeat cap on pases corto/largo — so
   * a possession is, in principle, unbounded. A human never stalls like that, but a
   * passive agent can, so a generous per-possession budget forces a breakdown; it is the
   * only thing that guarantees the 15-turno clock is ever reached.
   */
  possessionJugadas: number
  antiStall: AntiStall
  difficulty: Difficulty
}

/** Which record key a side's Nth player uses (`0` = keeper). */
export function playerId(side: Side, index: number): PlayerId {
  return `${side === 'home' ? 'h' : 'a'}${index}`
}

/** Shirt number for a player id: keeper (index 0) is 1, outfield 2–11 (football convention). */
export function dorsal(id: PlayerId): number {
  return Number(id.slice(1)) + 1
}

/** The two players sharing this key's side. */
export function sideOf(id: PlayerId): Side {
  return id[0] === 'h' ? 'home' : 'away'
}
