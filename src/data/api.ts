import { requireSupabase } from '@/lib/supabase'
import type {
  AdminUser,
  Card,
  CollectionEntry,
  Pack,
  Profile,
  Squad,
  SquadSlot,
} from '@/lib/types'
import type { ImportedCard } from '@/cards/csv'

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
    .order('name', { referencedTable: 'cards', ascending: true })
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
    .select('id, name, formation, total_cost')
    .order('is_active', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!squad) return null

  const { data: slots, error: slotErr } = await sb
    .from('squad_slots')
    .select('card_id, slot, is_starter')
    .eq('squad_id', squad.id)
    .order('slot', { ascending: true })
  if (slotErr) throw new Error(slotErr.message)

  return { ...squad, slots: (slots ?? []) as SquadSlot[] }
}

export async function saveSquad(
  name: string,
  formation: string,
  starters: string[],
  bench: string[],
): Promise<number> {
  const { data, error } = await requireSupabase().rpc('save_squad', {
    p_name: name,
    p_formation: formation,
    p_starters: starters,
    p_bench: bench,
  })
  if (error) throw new Error(error.message)
  return data as number
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
