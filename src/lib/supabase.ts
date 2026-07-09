import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when both Supabase env vars are present. Screens use this to show setup help. */
export const isSupabaseConfigured = Boolean(url && anonKey)

// When unconfigured we export null so the app can render a friendly setup screen
// instead of throwing at import time.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** Narrowing helper: throws if called before Supabase is configured. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase is not configured. Copy .env.example to .env and fill it in.')
  }
  return supabase
}
