import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchAppSettings, fetchProfile } from '@/data/api'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** Whether pre-launch waitlist mode is on (app_settings, 0021). Loaded with the
   *  session so the auth gate can read it before rendering; false while unknown. */
  waitlistEnabled: boolean
  refreshProfile: () => Promise<void>
  /** Re-pull app settings, e.g. after an admin flips the waitlist toggle. */
  refreshSettings: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [waitlistEnabled, setWaitlistEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  async function refreshProfile() {
    try {
      setProfile(await fetchProfile())
    } catch {
      setProfile(null)
    }
  }

  async function refreshSettings() {
    try {
      setWaitlistEnabled((await fetchAppSettings()).waitlist_enabled)
    } catch {
      // Fail open: the server trigger is the real gate, so defaulting to "not
      // gated" here at worst shows the signup form (whose signUp is still refused
      // while gated) rather than locking legitimate signups out on a read blip.
      setWaitlistEnabled(false)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    // Resolve the session AND the public flag before clearing `loading`, so the
    // unauthenticated gate never flashes the wrong CTA on first paint.
    Promise.all([
      supabase.auth.getSession().then(({ data }) => setSession(data.session)),
      refreshSettings(),
    ]).finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session) void refreshProfile()
    else setProfile(null)
  }, [session])

  async function signOut() {
    await supabase?.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        waitlistEnabled,
        refreshProfile,
        refreshSettings,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
