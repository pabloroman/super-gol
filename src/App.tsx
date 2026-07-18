import { useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Cog6ToothIcon } from '@heroicons/react/24/outline'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { BottomNav } from '@/ui/BottomNav'
import { Footer } from '@/ui/Footer'
import { Coin } from '@/ui/Coin'
import { TABS } from '@/ui/nav'
import { Login } from '@/screens/Login'
import { ResetPassword } from '@/screens/ResetPassword'
import { Landing } from '@/screens/Landing'
import { Home } from '@/screens/Home'
import { Collection } from '@/screens/Collection'
import { SquadBuilder } from '@/screens/SquadBuilder'
import { Store } from '@/screens/Store'
import { Play } from '@/screens/Play'
import { Admin } from '@/screens/Admin'
import { SetupNeeded } from '@/screens/SetupNeeded'

function TopBar() {
  const { profile, signOut } = useAuth()
  return (
    // The bar itself is full-bleed so its border and backdrop span the viewport;
    // only the inner row takes the width token. Both bars used to sit inside the
    // app's max-w-md column, so their borders stopped at 448px and the chrome
    // floated in a strip on any wider screen. h-topbar pins the height that
    // --topbar-h promises to everything sticking below it.
    <header className="sticky top-0 z-20 h-topbar border-b border-white/5 bg-pitch-950/90 backdrop-blur">
      <div className="app-wide flex h-full items-center gap-4 px-4 md:px-6">
        <Link
          to="/"
          className="shrink-0 font-display text-xl font-extrabold uppercase tracking-tight text-grass-400"
        >
          Super Gol
        </Link>

        {/* Desktop nav. Below md the same TABS render as the BottomNav, which
            hides itself here — exactly one nav exists at any width. */}
        <nav aria-label="Principal" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-white/10 text-grass-400'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                    }`
                  }
                >
                  <tab.icon className="h-5 w-5" aria-hidden />
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {profile?.is_admin && (
            <Link
              to="/admin"
              className="text-slate-400 transition hover:text-slate-200"
              title="Admin"
              aria-label="Admin"
            >
              <Cog6ToothIcon className="h-5 w-5" aria-hidden />
            </Link>
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-rare">
            <Coin />
            {profile?.coins ?? 0}
          </span>
          <button
            onClick={() => void signOut()}
            className="text-xs text-slate-400 transition hover:text-slate-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}

/**
 * True when we arrived via a Supabase auth-error hash (e.g. an expired email
 * confirmation link, `#error=access_denied&error_code=otp_expired&…`). A valid
 * `access_token` hash is consumed by supabase-js `detectSessionInUrl` before we
 * render — that path yields a session and never reaches here — so only the error
 * case matters: we start on the auth form so Login can surface it and offer a
 * resend, instead of hiding it behind the landing page.
 */
function hasAuthHash(): boolean {
  if (typeof window === 'undefined') return false
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return false
  const params = new URLSearchParams(hash)
  return Boolean(params.get('error') || params.get('error_code'))
}

/**
 * The unauthenticated view: a marketing landing page with the auth form one tap
 * away. A local toggle (not a route) keeps the existing all-or-nothing gate and
 * leaves Login's URL-hash handling untouched. `onStart`/`onSignIn` seed the auth
 * form's mode so the CTA the visitor pressed matches what they see.
 */
function Unauthenticated() {
  const [view, setView] = useState<'landing' | 'auth'>(
    hasAuthHash() ? 'auth' : 'landing',
  )
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  if (view === 'auth') {
    return <Login initialMode={mode} onBack={() => setView('landing')} />
  }
  return (
    <Landing
      onStart={() => {
        setMode('signup')
        setView('auth')
      }}
      onSignIn={() => {
        setMode('signin')
        setView('auth')
      }}
    />
  )
}

export default function App() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) return <SetupNeeded />

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        Cargando…
      </div>
    )
  }

  // The password-recovery callback. Rendered ahead of the session gate and
  // independent of `session` so it works both when the recovery link established
  // a session (set-new-password) and when it was expired (show the error). Using
  // useLocation keeps this reactive, so navigating away from it re-renders here.
  if (location.pathname === '/reset-password') return <ResetPassword />

  if (!session) return <Unauthenticated />

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="app-wide flex-1 px-4 py-4 md:px-6 md:py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/squad" element={<SquadBuilder />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/store" element={<Store />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <Footer />
      <BottomNav />
    </div>
  )
}
