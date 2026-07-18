/**
 * Client seam for the interactive match protocol (the server half lives in the
 * `play-match` Edge Function, `supabase/functions/_src/play-match.ts`).
 *
 * The contract, uniform for every jugada: the client sends an action id (or nothing, to
 * crank the AI's own turn) plus the `ply` it last saw; the server owns the state and the
 * dice and returns the next snapshot. The client never sends state back and never rolls a
 * die — that is what keeps the coins un-forgeable across ~100 round trips.
 *
 * `ply` is an optimistic-concurrency token: pass back the one from the last snapshot. A
 * stale `ply` (double-submit, replay) is refused with a `stale_ply` error carrying the
 * server's current `ply`.
 */

import { requireSupabase } from '@/lib/supabase'
import type { MatchState, Action } from '@/game/board'
import type { EngineEvent } from '@/game/engine/events'
import type { Difficulty } from '@/game/engine/types'

/** A point-in-time view of a session: whose turn (`state.phase.side`) + the legal menu. */
export interface MatchSnapshot {
  sessionId: string
  ply: number
  state: MatchState
  legal: Action[]
  events: EngineEvent[]
  /** The generated rival's club name (from `away_squad`); stable for the whole match. */
  opponent: string
}

/** The result of one jugada. `outcome` is present only when the match just finished. */
export interface ActResult {
  ply: number
  state: MatchState
  legal: Action[]
  events: EngineEvent[]
  outcome?: MatchFinish
}

/** What `finish_match_session` paid out (server-defined; never trusted from the client). */
export interface MatchFinish {
  coins: number
  coins_awarded: number
  match_id: number
  result: 'win' | 'loss' | 'draw'
  gf: number
  ga: number
}

/**
 * An error from the protocol. `code` mirrors the server's `error` string, so callers can
 * branch on `active_session` / `stale_ply` / `no_active_session` without string-matching a
 * localized message; `sessionId` / `ply` carry the server's view where relevant.
 */
export class MatchProtocolError extends Error {
  constructor(
    public code: string,
    public sessionId?: string,
    public ply?: number,
  ) {
    super(code)
    this.name = 'MatchProtocolError'
  }
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke('play-match', { body })
  if (!error) return data as T
  // supabase-js wraps a non-2xx response as a FunctionsHttpError with the Response in
  // `.context`; the structured body (error code, sessionId, ply) lives there.
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    const payload = await ctx.json().catch(() => null)
    if (payload && typeof payload.error === 'string') {
      throw new MatchProtocolError(payload.error, payload.sessionId, payload.ply)
    }
  }
  throw new Error(error.message)
}

/** Begin a new match. Rejects with `active_session` (carrying its id) if one is live. */
export function startMatch(difficulty: Difficulty): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>({ op: 'start', difficulty })
}

/** Reload the caller's live session (resume after a refresh). */
export function resumeMatch(): Promise<MatchSnapshot> {
  return invoke<MatchSnapshot>({ op: 'resume' })
}

/**
 * Advance one jugada. Pass `action` on the human's turn; omit it to crank the AI's own
 * turn (the server sees `state.phase.side === 'away'` and chooses). Always pass the `ply`
 * from the previous snapshot.
 */
export function actMatch(sessionId: string, ply: number, action?: Action): Promise<ActResult> {
  return invoke<ActResult>({ op: 'act', sessionId, ply, action })
}

/** Forfeit the live session; it is recorded as a loss. */
export function resignMatch(): Promise<{ status: string; outcome: MatchFinish }> {
  return invoke<{ status: string; outcome: MatchFinish }>({ op: 'resign' })
}
