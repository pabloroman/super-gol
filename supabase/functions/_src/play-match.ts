// play-match — the authoritative match resolver (SOURCE).
//
// Runs the SAME pure basic-game engine that lives in `src/game/engine/`, then
// commits the result through the `record_match` SECURITY DEFINER function using
// the service-role key. Because `record_match` is revoked from client roles, the
// scoreline and the coins it pays can only ever originate here — the browser can
// trigger a match but not forge one.
//
// This file imports the engine from the app source (`@/…`). It lives OUTSIDE the
// deployed function dir (Supabase ignores `_`-prefixed paths) and is NOT deployed
// directly: `npm run build:function` bundles it (engine inlined) into the
// self-contained `supabase/functions/play-match/index.ts` that Supabase actually
// deploys, so the function has no dependency on the repo layout at deploy time.

import { createClient } from 'npm:@supabase/supabase-js@2.47.10'
import type { Card, Squad, SquadSlot, MatchOutcome } from '@/lib/types.ts'
import type { Difficulty } from '@/game/engine/types.ts'
import { simulateMatch } from '@/game/engine/index.ts'
import { buildEngineSquad } from '@/game/engine/squad.ts'
import { generateOpponent } from '@/game/engine/opponent.ts'
import { createRng, seedFrom } from '@/game/engine/rng.ts'

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'not authenticated' }, 401)

  // User-scoped client: reads run under the caller's RLS (own squad + public cards).
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: auth } = await userClient.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return json({ error: 'not authenticated' }, 401)

  // Parse + validate difficulty.
  let difficulty: Difficulty = 'normal'
  try {
    const body = await req.json()
    if (body && DIFFICULTIES.includes(body.p_difficulty)) difficulty = body.p_difficulty
  } catch {
    // empty/invalid body → keep the default
  }

  // Load the active squad, its slots, and the card catalog (same as src/data/api.ts).
  const { data: squadRow, error: squadErr } = await userClient
    .from('squads')
    .select('id, name, formation, total_cost')
    .order('is_active', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (squadErr) return json({ error: squadErr.message }, 400)
  if (!squadRow) return json({ error: 'you have no squad yet' }, 400)

  const { data: slots, error: slotErr } = await userClient
    .from('squad_slots')
    .select('card_id, slot, is_starter')
    .eq('squad_id', squadRow.id)
    .order('slot', { ascending: true })
  if (slotErr) return json({ error: slotErr.message }, 400)

  const { data: catalog, error: catErr } = await userClient.from('cards').select('*')
  if (catErr) return json({ error: catErr.message }, 400)

  const squad: Squad = { ...squadRow, slots: (slots ?? []) as SquadSlot[] }
  const cards = (catalog ?? []) as Card[]

  // Build the human squad and a seeded opponent, then run the real engine.
  let home
  try {
    home = buildEngineSquad(squad.name || 'Tu equipo', squad, cards)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'invalid squad' }, 400)
  }
  const seed = seedFrom(Date.now(), difficulty, squad.id)
  const away = generateOpponent(difficulty, createRng(seedFrom(seed, 'opponent')))
  const outcome: MatchOutcome = simulateMatch({ home, away, difficulty, seed })

  // Strength = summed cost of the starters (kept for match history parity).
  const byId = new Map(cards.map((c) => [c.id, c]))
  const strength = squad.slots
    .filter((s) => s.is_starter)
    .reduce((sum, s) => sum + (byId.get(s.card_id)?.cost ?? 0), 0)

  // Commit the outcome authoritatively with the service-role key.
  const adminClient = createClient(url, serviceKey)
  const { data: recorded, error: recErr } = await adminClient.rpc('record_match', {
    p_uid: uid,
    p_opponent: outcome.opponent,
    p_difficulty: difficulty,
    p_result: outcome.result,
    p_gf: outcome.goals_for,
    p_ga: outcome.goals_against,
    p_squad_strength: strength,
    p_log: outcome.log,
  })
  if (recErr) return json({ error: recErr.message }, 500)

  // Reward is server-defined; use what record_match actually paid.
  return json({
    ...outcome,
    coins_awarded: (recorded as { coins_awarded: number }).coins_awarded,
  } satisfies MatchOutcome)
})
