// play-match — the authoritative match server (SOURCE).
//
// The interactive, turn-based basic game from `src/game/board/` (`op: start | act |
// resume | resign`). State lives in `match_sessions`; each jugada is one authenticated
// call. The invariant that keeps the anti-cheat posture intact across ~100 round trips
// instead of one: the client NEVER sends state back and NEVER rolls a die. It sends an
// action id and a ply token; the server loads the row, re-derives `legalActions`, rolls
// the dice from a seed it owns, applies exactly one step, and persists it. Coins are paid
// only by `record_match`, via `finish_match_session` (0014) so the pay + the match-id
// stamp are one transaction and a win can't be replayed.
//
// The function name is kept (the old one-shot simulate branch lived here too, retired in
// Phase 6) so config.toml's `verify_jwt = true` and the single build:function script
// don't change.
//
// This file imports the engine from the app source (`@/…`); `npm run build:function`
// bundles it (engine inlined) into the deployed `../play-match/index.ts`. Never hand-edit
// that generated file.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.47.10'
import type { Card, Squad, SquadSlot } from '@/lib/types.ts'
import type { Difficulty } from '@/game/engine/types.ts'
import { buildEngineSquad } from '@/game/engine/squad.ts'
import { generateOpponent } from '@/game/engine/opponent.ts'
import { createRng, seedFrom } from '@/game/engine/rng.ts'
import {
  createMatch,
  legalActions,
  apply,
  type MatchState,
  type Action,
  type Side,
} from '@/game/board/index.ts'
import { chooseAction } from '@/game/board/ai.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function pickDifficulty(raw: unknown): Difficulty {
  return DIFFICULTIES.includes(raw as Difficulty) ? (raw as Difficulty) : 'normal'
}

/** Whose input a non-terminal phase needs. */
function phaseSide(state: MatchState): Side {
  return (state.phase as { side: Side }).side
}

// ── shared: build the human squad + its strength from the caller's own data ──────

type HomeContext = { home: ReturnType<typeof buildEngineSquad>; strength: number; squadId: number }

async function loadHome(userClient: SupabaseClient): Promise<HomeContext | { error: string; status: number }> {
  const { data: squadRow, error: squadErr } = await userClient
    .from('squads')
    .select('id, name, total_cost')
    .order('is_active', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (squadErr) return { error: squadErr.message, status: 400 }
  if (!squadRow) return { error: 'you have no squad yet', status: 400 }

  const { data: slots, error: slotErr } = await userClient
    .from('squad_slots')
    .select('card_id, slot')
    .eq('squad_id', squadRow.id)
    .order('slot', { ascending: true })
  if (slotErr) return { error: slotErr.message, status: 400 }

  const { data: catalog, error: catErr } = await userClient.from('cards').select('*')
  if (catErr) return { error: catErr.message, status: 400 }

  const squad: Squad = { ...squadRow, slots: (slots ?? []) as SquadSlot[] }
  const cards = (catalog ?? []) as Card[]
  let home
  try {
    home = buildEngineSquad(squad.name || 'Tu equipo', squad, cards)
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'invalid squad', status: 400 }
  }
  const byId = new Map(cards.map((c) => [c.id, c]))
  const strength = squad.slots.reduce((sum, s) => sum + (byId.get(s.card_id)?.cost ?? 0), 0)
  return { home, strength, squadId: squadRow.id }
}

// ── interactive: start | act | resume | resign ───────────────────────────────────

async function startMatch(
  userClient: SupabaseClient,
  adminClient: SupabaseClient,
  uid: string,
  difficulty: Difficulty,
): Promise<Response> {
  // One live session per user (the anti-farming spine). Refuse a second; the client must
  // resume or resign the existing one first.
  const { data: active } = await adminClient
    .from('match_sessions')
    .select('id')
    .eq('user_id', uid)
    .eq('status', 'active')
    .maybeSingle()
  if (active) return json({ error: 'active_session', sessionId: active.id }, 409)

  const ctx = await loadHome(userClient)
  if ('error' in ctx) return json({ error: ctx.error }, ctx.status)

  const seed = seedFrom(Date.now(), difficulty, ctx.squadId)
  const away = generateOpponent(difficulty, createRng(seedFrom(seed, 'opponent')))
  const state = createMatch({ home: ctx.home, away, difficulty })

  const { data: inserted, error: insErr } = await adminClient
    .from('match_sessions')
    .insert({
      user_id: uid,
      difficulty,
      status: 'active',
      seed,
      ply: state.ply,
      state,
      away_squad: away,
      log: [],
      squad_strength: ctx.strength,
    })
    .select('id')
    .single()
  if (insErr) {
    // Lost a race on the unique-active index: surface the existing session to resume.
    if (insErr.code === '23505') {
      const { data: existing } = await adminClient
        .from('match_sessions')
        .select('id')
        .eq('user_id', uid)
        .eq('status', 'active')
        .maybeSingle()
      return json({ error: 'active_session', sessionId: existing?.id }, 409)
    }
    return json({ error: insErr.message }, 500)
  }

  return json({
    sessionId: inserted.id,
    ply: state.ply,
    state,
    legal: legalActions(state),
    events: [],
    opponent: away.name,
  })
}

async function resumeMatch(userClient: SupabaseClient, uid: string): Promise<Response> {
  // Reading your own session is harmless — perfect-information board game, nothing hidden.
  const { data: session } = await userClient
    .from('match_sessions')
    .select('id, state, ply, away_squad, log')
    .eq('user_id', uid)
    .eq('status', 'active')
    .maybeSingle()
  if (!session) return json({ error: 'no_active_session' }, 404)
  const state = session.state as MatchState
  // Replay the whole chronicle so a refresh restores the log, not just the board. The
  // client renders these exactly like a live `act`'s events.
  const events = (session.log as unknown[]) ?? []
  const opponent = (session.away_squad as { name?: string })?.name ?? 'Rival'
  return json({ sessionId: session.id, ply: session.ply, state, legal: legalActions(state), events, opponent })
}

async function resignMatch(adminClient: SupabaseClient, uid: string): Promise<Response> {
  const { data: session } = await adminClient
    .from('match_sessions')
    .select('id')
    .eq('user_id', uid)
    .eq('status', 'active')
    .maybeSingle()
  if (!session) return json({ error: 'no_active_session' }, 404)
  // A resignation is recorded as a loss (you can't rage-quit out of a defeat).
  const { data: paid, error } = await adminClient.rpc('finish_match_session', {
    p_uid: uid,
    p_session_id: session.id,
    p_forfeit: true,
  })
  if (error) return json({ error: error.message }, 400)
  return json({ status: 'abandoned', outcome: paid })
}

/** Pay + record + stamp an over (or forfeited) session. One-transaction guard lives in SQL. */
async function finishSession(
  adminClient: SupabaseClient,
  uid: string,
  sessionId: string,
): Promise<{ outcome: unknown } | { error: string; status: number }> {
  const { data: paid, error } = await adminClient.rpc('finish_match_session', {
    p_uid: uid,
    p_session_id: sessionId,
    p_forfeit: false,
  })
  if (error) return { error: error.message, status: 400 }
  return { outcome: paid }
}

async function actMatch(
  adminClient: SupabaseClient,
  uid: string,
  body: { sessionId?: string; ply?: number; action?: Action },
): Promise<Response> {
  const sessionId = body.sessionId
  if (!sessionId) return json({ error: 'sessionId required' }, 400)

  // The service-role read is the source of truth (the client's copy is never trusted).
  const { data: session, error: loadErr } = await adminClient
    .from('match_sessions')
    .select('id, user_id, status, seed, ply, state, difficulty, log')
    .eq('id', sessionId)
    .maybeSingle()
  if (loadErr) return json({ error: loadErr.message }, 400)
  if (!session || session.user_id !== uid) return json({ error: 'session not found' }, 404)
  if (session.status !== 'active') return json({ error: 'session not active' }, 409)

  // Optimistic-concurrency token: the client must act on the ply it last saw.
  if (typeof body.ply === 'number' && body.ply !== session.ply) {
    return json({ error: 'stale_ply', ply: session.ply, state: session.state }, 409)
  }

  const state = session.state as MatchState
  const difficulty = pickDifficulty(session.difficulty)

  // A prior act may have reached fulltime but not finished (e.g. a transient on the finish
  // RPC). Finish it now rather than stranding the session.
  if (state.phase.kind === 'fulltime') {
    const fin = await finishSession(adminClient, uid, sessionId)
    if ('error' in fin) return json({ error: fin.error }, fin.status)
    return json({ state, ply: session.ply, legal: [], events: [], outcome: fin.outcome })
  }

  const side = phaseSide(state)
  let action: Action
  if (side === 'away') {
    // The AI's own jugada — the server chooses it (the client cranks with no action). The
    // choice RNG is addressed separately from the dice so the decision order can't reshuffle
    // the roll (see the RNG note in the plan).
    action = chooseAction(state, createRng(seedFrom(session.seed, session.ply, 'ai')), difficulty)
  } else {
    // The human's jugada. Trust nothing about it beyond membership in legalActions, which
    // apply() re-derives and enforces below.
    if (!body.action || typeof (body.action as Action).kind !== 'string') {
      return json({ error: 'action required' }, 400)
    }
    action = body.action
  }

  // Dice come from an address unique to (seed, ply, action.kind). apply() re-validates the
  // action against a freshly recomputed legalActions and throws on anything illegal/forged.
  const diceRng = createRng(seedFrom(session.seed, session.ply, action.kind))
  let next: MatchState
  let events
  try {
    const res = apply(state, action, diceRng)
    next = res.state
    events = res.events
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'illegal action' }, 400)
  }

  const newPly = session.ply + 1
  next.ply = newPly
  const newLog = [...((session.log as unknown[]) ?? []), ...events]

  // Persist, guarded on the ply we read: a concurrent advance matches 0 rows → stale.
  const { data: updated, error: updErr } = await adminClient
    .from('match_sessions')
    .update({ state: next, ply: newPly, log: newLog, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('ply', session.ply)
    .eq('status', 'active')
    .select('id')
    .maybeSingle()
  if (updErr) return json({ error: updErr.message }, 500)
  if (!updated) return json({ error: 'stale_ply', ply: session.ply }, 409)

  let outcome: unknown
  if (next.phase.kind === 'fulltime') {
    const fin = await finishSession(adminClient, uid, sessionId)
    if ('error' in fin) return json({ error: fin.error }, fin.status)
    outcome = fin.outcome
  }

  return json({ state: next, ply: newPly, legal: legalActions(next), events, outcome })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'not authenticated' }, 401)

  // User-scoped client: reads run under the caller's RLS (own squad/session + public cards).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: auth } = await userClient.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return json({ error: 'not authenticated' }, 401)

  // Service-role client: the only thing that may write game state or pay coins.
  const adminClient = createClient(url, serviceKey)

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) ?? {}
  } catch {
    // empty/invalid body → treat as legacy with default difficulty
  }

  switch (body.op) {
    case 'start':
      return startMatch(userClient, adminClient, uid, pickDifficulty(body.difficulty))
    case 'act':
      return actMatch(adminClient, uid, body as { sessionId?: string; ply?: number; action?: Action })
    case 'resume':
      return resumeMatch(userClient, uid)
    case 'resign':
      return resignMatch(adminClient, uid)
    default:
      return json({ error: 'unknown op' }, 400)
  }
})
