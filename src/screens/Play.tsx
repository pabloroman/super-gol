import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { matchEngine, DIFFICULTIES, type Difficulty } from '@/game/engine'
import type { MatchOutcome } from '@/lib/types'

const RESULT_COPY = {
  win: { title: '¡Victoria!', color: 'text-grass-400' },
  draw: { title: 'Empate', color: 'text-frequent' },
  loss: { title: 'Derrota', color: 'text-red-400' },
}

export function Play() {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function play(difficulty: Difficulty) {
    setBusy(true)
    setError(null)
    setOutcome(null)
    try {
      const result = await matchEngine.play(difficulty)
      setOutcome(result)
      await refreshProfile()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo jugar el partido')
    } finally {
      setBusy(false)
    }
  }

  if (outcome) {
    const copy = RESULT_COPY[outcome.result]
    return (
      <div className="flex flex-col gap-4">
        <div className="card-surface p-6 text-center">
          <div className={`font-display text-3xl font-extrabold ${copy.color}`}>
            {copy.title}
          </div>
          <div className="mt-2 text-5xl font-bold tabular-nums">
            {outcome.goals_for} – {outcome.goals_against}
          </div>
          <div className="mt-1 text-sm text-slate-400">vs {outcome.opponent}</div>
          <div className="mt-3 inline-block rounded-full bg-black/40 px-4 py-1 font-bold text-rare">
            +{outcome.coins_awarded} 🪙
          </div>
        </div>

        <div className="card-surface p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Crónica
          </h3>
          <ul className="space-y-1 text-sm">
            {outcome.log.map((e, i) => (
              <li key={i} className="flex gap-2 text-slate-300">
                <span className="w-8 shrink-0 tabular-nums text-slate-500">
                  {e.minute}'
                </span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <button className="btn-primary" onClick={() => setOutcome(null)}>
          Jugar otro
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Elige rival</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {DIFFICULTIES.map((d) => (
        <button
          key={d.id}
          disabled={busy}
          onClick={() => play(d.id)}
          className="card-surface flex items-center justify-between p-5 text-left transition active:scale-[0.99] disabled:opacity-50"
        >
          <div>
            <div className="font-display text-xl font-bold">{d.label}</div>
            <div className="text-sm text-slate-400">{d.blurb}</div>
          </div>
          <span className="text-2xl">▶</span>
        </button>
      ))}
      {busy && <p className="text-center text-slate-400">Jugando…</p>}
    </div>
  )
}
