import { Link, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/auth/AuthProvider'
import { BottomNav } from '@/ui/BottomNav'
import { Login } from '@/screens/Login'
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
    <header className="sticky top-0 z-20 border-b border-white/5 bg-pitch-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
        <span className="font-display text-xl font-extrabold uppercase tracking-tight text-grass-400">
          Super Gol
        </span>
        <div className="flex items-center gap-3">
          {profile?.is_admin && (
            <Link to="/admin" className="text-xs text-slate-400 hover:text-slate-200" title="Admin">
              ⚙️
            </Link>
          )}
          <span className="flex items-center gap-1 rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-rare">
            <span aria-hidden>🪙</span>
            {profile?.coins ?? 0}
          </span>
          <button
            onClick={() => void signOut()}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <SetupNeeded />

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-400">
        Cargando…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <TopBar />
      <main className="flex-1 px-4 py-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Play />} />
          <Route path="/squad" element={<SquadBuilder />} />
          <Route path="/collection" element={<Collection />} />
          <Route path="/store" element={<Store />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}
