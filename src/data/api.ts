import { requireSupabase } from '@/lib/supabase'
import type {
  AdminUser,
  AppSettings,
  Card,
  CollectionEntry,
  Match,
  Pack,
  Profile,
  Squad,
  SquadSlot,
  WaitlistEntry,
} from '@/lib/types'
import type { ImportedCard } from '@/cards/csv'

// ---------- app settings (public config) ----------
/**
 * The public config singleton (0021). Anon-readable, so it loads before there is
 * a session. Falls back to `waitlist_enabled: false` if the row is somehow
 * absent — the server trigger is the real gate, so failing open here at worst
 * shows the signup form (whose signUp the trigger still refuses while gated).
 */
export async function fetchAppSettings(): Promise<AppSettings> {
  const { data, error } = await requireSupabase()
    .from('app_settings')
    .select('waitlist_enabled')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? { waitlist_enabled: false }
}

// ---------- waitlist ----------
/** Add an email to the pre-launch waitlist. Idempotent server-side (a repeat is a
 *  silent success), so the caller can always show the same confirmation. */
export async function joinWaitlist(email: string): Promise<void> {
  const { error } = await requireSupabase().rpc('join_waitlist', { p_email: email })
  if (error) throw new Error(error.message)
}

/**
 * Resolve an `?invite=<id>` link to its email (0022) so the signup form can
 * pre-fill and lock it. Anon-callable — the invited visitor has no session yet.
 * Returns null for an unknown or still-pending id (an uninvited email is never
 * disclosed), which the caller treats as "no valid invite".
 */
export async function fetchWaitlistInviteEmail(id: string): Promise<string | null> {
  const { data, error } = await requireSupabase().rpc('waitlist_invite_email', {
    p_id: id,
  })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

// ---------- profile / wallet ----------
export async function fetchProfile(): Promise<Profile | null> {
  const sb = requireSupabase()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await sb
    .from('profiles')
    .select('id, username, coins, is_admin')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// ---------- catalog ----------
export async function fetchCatalog(): Promise<Card[]> {
  const { data, error } = await requireSupabase()
    .from('cards')
    .select('*')
    .order('cost', { ascending: false })
  if (error) throw new Error(error.message)
  return data as Card[]
}

/**
 * Fetch specific cards by id (the landing showcase pool). Anon-readable, same as
 * `fetchCatalog` — the `cards` "public" SELECT policy (0002) + anon grant (0007).
 * NOTE: `.in()` does not preserve the order of `ids` and returns only the ids that
 * still exist in the catalog, so callers must not assume a 1:1 length or ordering.
 */
export async function fetchCardsByIds(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return []
  const { data, error } = await requireSupabase()
    .from('cards')
    .select('*')
    .in('id', ids)
  if (error) throw new Error(error.message)
  return data as Card[]
}

// ---------- collection ----------
export async function fetchCollection(): Promise<CollectionEntry[]> {
  const { data, error } = await requireSupabase()
    .from('user_cards')
    .select('quantity, card:cards(*)')
    .gt('quantity', 0)
    // Without this the collection comes back in whatever order Postgres feels
    // like, which shows through as a grid that reshuffles between visits. The
    // UI re-sorts on top of this (see useCardFilters); this just pins a stable
    // baseline.
    .order('cost', { referencedTable: 'cards', ascending: false })
    .order('full_name', { referencedTable: 'cards', ascending: true })
  if (error) throw new Error(error.message)
  // Supabase returns the joined card as an object under `card`.
  return (data as unknown as { quantity: number; card: Card }[]).map((row) => ({
    quantity: row.quantity,
    card: row.card,
  }))
}

// ---------- squad ----------
export async function fetchActiveSquad(): Promise<Squad | null> {
  const sb = requireSupabase()
  const { data: squad, error } = await sb
    .from('squads')
    .select('id, name, total_cost')
    .order('is_active', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!squad) return null

  const { data: slots, error: slotErr } = await sb
    .from('squad_slots')
    .select('card_id, slot')
    .eq('squad_id', squad.id)
    .order('slot', { ascending: true })
  if (slotErr) throw new Error(slotErr.message)

  return { ...squad, slots: (slots ?? []) as SquadSlot[] }
}

export async function saveSquad(name: string, starters: string[]): Promise<number> {
  const { data, error } = await requireSupabase().rpc('save_squad', {
    p_name: name,
    p_starters: starters,
  })
  if (error) throw new Error(error.message)
  return data as number
}

// ---------- match history ----------
/**
 * The caller's finished games, newest first. RLS (0002 + 0007_table_grants) scopes
 * `matches` to its owner, so no explicit user filter is needed. `limit` keeps the Home
 * summary compact; the crónica `log` column is left unselected — the list only shows the
 * scoreline.
 */
export async function fetchMatches(limit = 5): Promise<Match[]> {
  const { data, error } = await requireSupabase()
    .from('matches')
    .select(
      'id, opponent_name, difficulty, result, goals_for, goals_against, coins_awarded, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Match[]
}

// ---------- store ----------
export async function fetchPacks(): Promise<Pack[]> {
  const { data, error } = await requireSupabase()
    .from('packs')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return data as Pack[]
}

export interface PackResult {
  coins: number
  cards: string[]
}

export async function openPack(packId: string): Promise<PackResult> {
  const { data, error } = await requireSupabase().rpc('open_pack', {
    p_pack_id: packId,
  })
  if (error) throw new Error(error.message)
  return data as PackResult
}

// ---------- admin (card catalog) ----------
// Both go through SECURITY DEFINER RPCs that verify the caller's profiles.is_admin
// server-side, matching the save_squad/open_pack pattern — the browser can call
// but cannot forge admin rights.
export async function adminUpsertCards(cards: ImportedCard[]): Promise<number> {
  const { data, error } = await requireSupabase().rpc('admin_upsert_cards', {
    p_cards: cards,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function adminDeleteCard(id: string): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_delete_card', { p_id: id })
  if (error) throw new Error(error.message)
}

// ---------- admin (users) ----------
// Same posture again (0011): profiles RLS still exposes only your own row to a
// client, so the list has to come from an RPC that verifies is_admin as owner
// rather than from a widened policy.
export async function adminListUsers(): Promise<AdminUser[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_users')
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminUser[]
}

export async function adminSetAdmin(userId: string, isAdmin: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_admin', {
    p_user_id: userId,
    p_is_admin: isAdmin,
  })
  if (error) throw new Error(error.message)
}

/** `amount` is signed (+credit / -debit). Returns the new balance. */
export async function adminAdjustCoins(
  userId: string,
  amount: number,
  reason: string,
): Promise<number> {
  const { data, error } = await requireSupabase().rpc('admin_adjust_coins', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return data as number
}

// ---------- admin (store packs) ----------
// Same posture again (0023): packs are read-only to clients (SELECT-only RLS), so
// a price edit goes through a require_admin() RPC. The list itself is the public
// fetchPacks() above. Prices are read live by the Store, so an edit needs no other
// plumbing to take effect.
export async function adminSetPackPrice(packId: string, price: number): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_pack_price', {
    p_pack_id: packId,
    p_price: price,
  })
  if (error) throw new Error(error.message)
}

// ---------- admin (waitlist) ----------
// Same posture (0021): the flag and the list of emails are written/read through
// SECURITY DEFINER RPCs behind require_admin(), not client table access.
export async function adminSetWaitlist(enabled: boolean): Promise<void> {
  const { error } = await requireSupabase().rpc('admin_set_waitlist', {
    p_enabled: enabled,
  })
  if (error) throw new Error(error.message)
}

export async function adminListWaitlist(): Promise<WaitlistEntry[]> {
  const { data, error } = await requireSupabase().rpc('admin_list_waitlist')
  if (error) throw new Error(error.message)
  return (data ?? []) as WaitlistEntry[]
}

/**
 * Invite the given waitlist entries (0022): the `send-invites` Edge Function marks
 * each still-pending row invited and emails it a signup link. Admin-only, verified
 * server-side. Returns per-run counts; a `failed` count means some emails didn't
 * send (those rows stay pending and can be retried).
 */
export async function adminSendInvites(
  ids: string[],
): Promise<{ sent: number; failed: number }> {
  const { data, error } = await requireSupabase().functions.invoke('send-invites', {
    body: { ids },
  })
  if (error) {
    // supabase-js wraps a non-2xx as a FunctionsHttpError with the Response in
    // `.context`; surface the server's error string when present (mirrors matchSession).
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      const payload = await ctx.json().catch(() => null)
      if (payload && typeof payload.error === 'string') throw new Error(payload.error)
    }
    throw new Error(error.message)
  }
  return data as { sent: number; failed: number }
}
