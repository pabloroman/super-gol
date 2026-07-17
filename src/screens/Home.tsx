import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { fetchActiveSquad } from '@/data/api'
import type { Squad } from '@/lib/types'

export function Home() {
  const { profile } = useAuth()
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActiveSquad()
      .then(setSquad)
      .finally(() => setLoading(false))
  }, [])

  const starterCount = squad?.slots.filter((s) => s.is_starter).length ?? 0
  const ready = starterCount === 11

  return (
    // app-measure, not the wide default: this screen is a greeting, one summary
    // card and a CTA. A primary button has no business spanning a monitor.
    <div className="app-measure flex flex-col gap-5">
      <div>
        <p className="text-slate-400">Hola,</p>
        <h1 className="font-display text-3xl font-bold">
          {profile?.username ?? 'Entrenador'}
        </h1>
      </div>

      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Tu equipo
        </h2>
        {loading ? (
          <p className="mt-2 text-slate-500">Cargando…</p>
        ) : squad ? (
          <div className="mt-2 flex items-end justify-between">
            <div>
              <div className="font-display text-2xl font-bold">{squad.name}</div>
              <div className="text-sm text-slate-400">
                {squad.formation} · {squad.total_cost}/100 pts · {starterCount}/11
                titulares
              </div>
            </div>
            <Link to="/squad" className="btn-ghost text-sm">
              Editar
            </Link>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-slate-400">Aún no has formado tu equipo.</p>
            <Link to="/squad" className="btn-primary mt-3 w-full">
              Formar equipo
            </Link>
          </div>
        )}
      </div>

      <Link
        to="/play"
        className={`btn-primary h-16 text-lg ${ready ? '' : 'pointer-events-none opacity-50'}`}
      >
        ⚽ Jugar partido
      </Link>
      {!ready && !loading && (
        <p className="-mt-2 text-center text-xs text-slate-500">
          Necesitas 11 titulares para jugar.
        </p>
      )}
    </div>
  )
}
