import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlayIcon } from '@heroicons/react/24/solid'
import { useAuth } from '@/auth/AuthProvider'
import { fetchActiveSquad, fetchMatches } from '@/data/api'
import { Coin } from '@/ui/Coin'
import type { Match, MatchResultKind, Squad } from '@/lib/types'

/** Result badge: a single letter (Victoria / Empate / Derrota) in the result's colour. */
const RESULT: Record<MatchResultKind, { letter: string; cls: string }> = {
  win: { letter: 'V', cls: 'text-grass-400' },
  draw: { letter: 'E', cls: 'text-frequent' },
  loss: { letter: 'D', cls: 'text-red-400' },
}

function matchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

export function Home() {
  const { profile } = useAuth()
  const [squad, setSquad] = useState<Squad | null>(null)
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState<Match[]>([])

  useEffect(() => {
    fetchActiveSquad()
      .then(setSquad)
      .finally(() => setLoading(false))
    // History is a secondary summary: if it fails, just show nothing rather than
    // erroring the whole home screen.
    fetchMatches()
      .then(setMatches)
      .catch(() => setMatches([]))
  }, [])

  const starterCount = squad?.slots.length ?? 0
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
                {squad.total_cost}/100 pts · {starterCount}/11 titulares
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
        <PlayIcon className="h-6 w-6" aria-hidden />
        Jugar partido
      </Link>
      {!ready && !loading && (
        <p className="-mt-2 text-center text-xs text-slate-500">
          Necesitas 11 titulares para jugar.
        </p>
      )}

      {matches.length > 0 && (
        <div className="card-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Últimos partidos
          </h2>
          <ul className="mt-2 divide-y divide-white/5">
            {matches.map((m) => {
              const r = RESULT[m.result]
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded bg-black/30 text-sm font-bold ${r.cls}`}
                  >
                    {r.letter}
                  </span>
                  <span className="shrink-0 text-lg font-bold tabular-nums">
                    {m.goals_for}–{m.goals_against}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-slate-200">{m.opponent_name}</div>
                    <div className="text-xs text-slate-500">{matchDate(m.created_at)}</div>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-rare">
                    +{m.coins_awarded} <Coin />
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
