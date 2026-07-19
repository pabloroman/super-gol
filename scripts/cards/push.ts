// Push the abilities from the hand-edited scripts/cards/data/overrides.json to a live Super
// Gol database.
//
// This is the ONLY channel that changes card ABILITIES on a live (hosted) database: the
// catalog is not a migration — it is a local seed (seed_cards.sql) plus the admin CSV import
// on prod — so a local `db reset` and this push both derive from overrides.json and converge.
// It writes ONLY the `abilities` column — every other overlay field (name, cost, rarity, photo,
// zone grid) and the starter deck reach a live DB through the admin CSV import, not here, so
// they are left untouched. It DOES overwrite any in-app admin edits to abilities for the cards
// it touches; that is the point.
//
// Auth: uses the service_role key to call service_set_card_abilities (0018), a SECURITY DEFINER
// RPC granted to service_role alone. (admin_upsert_cards is unusable here — its require_admin()
// checks auth.uid(), which a service key has none of; and service_role has no direct grant on
// the cards table, so the write goes through the definer function.) Never expose the service key
// to the browser (no VITE_ prefix).
//
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run push:cards            # dry-run
//   … PUSH_CONFIRM=<project-ref> npm run push:cards -- --commit              # write to remote
//   … npm run push:cards -- --commit --local                                # write to local

import { createClient } from '@supabase/supabase-js'
import type { Abilities, AbilityKey } from '../../src/lib/types'
import { loadOverrides } from './rows'

const args = new Set(process.argv.slice(2))
const COMMIT = args.has('--commit')
const ALLOW_LOCAL = args.has('--local')

function die(msg: string): never {
  console.error(`push:cards — ${msg}`)
  process.exit(1)
}

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  die('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (see .env.example).')
}

const hostname = new URL(url).hostname
const isLocal = hostname === '127.0.0.1' || hostname === 'localhost'
const ref = hostname.endsWith('.supabase.co') ? hostname.split('.')[0] : hostname

/** Equal ignoring key order and treating an absent factor as 0 (rulebook page 6). */
function sameAbilities(a: Abilities, b: Abilities): boolean {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k as AbilityKey] ?? 0) !== (b[k as AbilityKey] ?? 0)) return false
  }
  return true
}

async function main() {
  // push writes ONLY the abilities column — pull just that field out of each overlay entry.
  const overrides = loadOverrides()
  const cards: Record<string, Abilities> = {}
  for (const [id, o] of Object.entries(overrides)) if (o.abilities) cards[id] = o.abilities
  const ids = Object.keys(cards)
  if (ids.length === 0) die('overrides.json has no abilities or is absent — run `npm run reseed:cards` first.')

  const supabase = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existing, error } = await supabase.from('cards').select('id, abilities')
  if (error) die(`could not read cards (check URL / service key): ${error.message}`)
  const dbById = new Map((existing ?? []).map((r) => [r.id as string, (r.abilities ?? {}) as Abilities]))

  const missingInDb = ids.filter((id) => !dbById.has(id))
  const changed = ids.filter((id) => dbById.has(id) && !sameAbilities(dbById.get(id)!, cards[id]))
  const inDbNotJson = [...dbById.keys()].filter((id) => !(id in cards))

  console.log(`target:        ${hostname} (${ref})`)
  console.log(`overrides.json: ${ids.length} cards`)
  console.log(`  to update:    ${changed.length}`)
  console.log(`  unchanged:    ${ids.length - changed.length - missingInDb.length}`)
  console.log(`  not in DB:    ${missingInDb.length} (skipped)`)
  console.log(`  in DB only:   ${inDbNotJson.length} (left untouched)`)
  if (missingInDb.length > 0) {
    console.log(`  e.g. missing: ${missingInDb.slice(0, 5).join(', ')}`)
  }

  if (!COMMIT) {
    console.log('\ndry-run — nothing written. Re-run with `-- --commit` to apply.')
    return
  }

  // Write guards.
  if (isLocal) {
    if (!ALLOW_LOCAL) die('refusing to write to a local database without `--local`.')
  } else if (process.env.PUSH_CONFIRM !== ref) {
    die(`refusing to write to remote project "${ref}" — re-run with PUSH_CONFIRM=${ref}.`)
  }
  if (changed.length === 0) {
    console.log('\nnothing to update — DB already matches overrides.json.')
    return
  }

  console.log(
    `\nWARNING: overwriting the abilities column for ${changed.length} card(s). ` +
      'This replaces any in-app admin ability edits for them.',
  )
  // service_set_card_abilities (0018): SECURITY DEFINER, service_role-only. Updates
  // ONLY the abilities column and ONLY existing rows — `changed` is already filtered
  // to ids present in the DB, so every one matches; anything absent is a no-op.
  const payload = changed.map((id) => ({ id, abilities: cards[id] }))
  const { data, error: wErr } = await supabase.rpc('service_set_card_abilities', { p_cards: payload })
  if (wErr) die(`update failed: ${wErr.message}`)
  console.log(`updated ${data ?? payload.length} card(s) on ${ref}.`)
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))
