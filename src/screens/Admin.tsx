import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { AdminCards } from '@/screens/AdminCards'
import { AdminPacks } from '@/screens/AdminPacks'
import { AdminUsers } from '@/screens/AdminUsers'
import { AdminWaitlist } from '@/screens/AdminWaitlist'

type TabId = 'cards' | 'users' | 'packs' | 'waitlist'

const TABS: { id: TabId; label: string }[] = [
  { id: 'cards', label: 'Cartas' },
  { id: 'users', label: 'Usuarios' },
  { id: 'packs', label: 'Sobres' },
  { id: 'waitlist', label: 'Lista de espera' },
]

/**
 * The admin shell: the is_admin gate and the tab switcher. Each tab is its own
 * screen module — Cartas was already ~490 lines on its own, so the two live in
 * AdminCards/AdminUsers and this file stays the thing that picks between them.
 *
 * Local state, not routes: these are two views of one screen, not two
 * destinations. `/admin` is deliberately absent from the TABS in src/ui/nav.ts —
 * it is the conditional gear in the TopBar, not a player destination — and
 * nesting routes under it would only add a second nav list to keep in sync.
 *
 * The gate is UX, not security: every write behind both tabs goes through a
 * SECURITY DEFINER RPC that re-checks profiles.is_admin server-side (0006, 0011),
 * so a forged is_admin in the client would reveal empty screens and nothing else.
 */
export function Admin() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<TabId>('cards')

  if (!profile?.is_admin) {
    return <p className="text-slate-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-2xl font-bold">Admin</h1>
        {/* Same shape as the TopBar's inline tabs, so the two nav surfaces read
            as one system. md:hover: because Tailwind emits hover: unconditionally
            here and a phone would leave it stuck after the tap. */}
        <nav aria-label="Secciones de admin">
          <ul className="flex items-center gap-1">
            {TABS.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setTab(t.id)}
                  aria-current={tab === t.id ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    tab === t.id
                      ? 'bg-white/10 text-grass-400'
                      : 'text-slate-400 md:hover:bg-white/5 md:hover:text-slate-100'
                  }`}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Unmounted, not hidden: the catalog is 518 unvirtualized rows, and
          keeping it mounted behind the other tab would leave that DOM live for
          nothing. The cost is a re-fetch on tab switch, which is the cheaper
          side of the trade. */}
      {tab === 'cards' ? (
        <AdminCards />
      ) : tab === 'users' ? (
        <AdminUsers />
      ) : tab === 'packs' ? (
        <AdminPacks />
      ) : (
        <AdminWaitlist />
      )}
    </div>
  )
}
