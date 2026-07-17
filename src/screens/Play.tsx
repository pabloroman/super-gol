import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { matchEngine, DIFFICULTIES, type Difficulty } from '@/game/engine'
import type { MatchOutcome } from '@/lib/types'
import { PitchBoard } from '@/ui/PitchBoard'

const RESULT_COPY = {
  win: { title: '¡Victoria!', color: 'text-grass-400' },
  draw: { title: 'Empate', color: 'text-frequent' },
  loss: { title: 'Derrota', color: 'text-red-400' },
}

/** Milliseconds each event holds on screen during an auto-replay. */
const REPLAY_MS = 1100

export function Play() {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Index of the crónica event the replay is currently showing.
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const activeRef = useRef<HTMLLIElement | null>(null)

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

  // A fresh outcome: rest on the final event, playback stopped.
  useEffect(() => {
    if (outcome) setStep(Math.max(0, outcome.log.length - 1))
    setPlaying(false)
  }, [outcome])

  // Auto-advance the replay one event at a time.
  useEffect(() => {
    if (!playing || !outcome) return
    if (step >= outcome.log.length - 1) {
      setPlaying(false)
      return
    }
    const id = setTimeout(() => setStep((s) => s + 1), REPLAY_MS)
    return () => clearTimeout(id)
  }, [playing, step, outcome])

  // Keep the highlighted crónica line in view as the replay advances.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [step])

  if (outcome) {
    const copy = RESULT_COPY[outcome.result]
    // The ball sits on the most recent event that carried a cell.
    let ball: MatchOutcome['log'][number] | undefined
    for (let i = step; i >= 0; i--) {
      if (outcome.log[i]?.params?.cell) {
        ball = outcome.log[i]
        break
      }
    }
    const atEnd = step >= outcome.log.length - 1

    function replayControl() {
      if (playing) setPlaying(false)
      else if (atEnd) {
        setStep(0)
        setPlaying(true)
      } else setPlaying(true)
    }

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

        {/* Pitch beside crónica above md. The pitch track is capped at 22rem on
            purpose: PitchBoard's cells scale, but its ball marker, centre circle
            and goal mouths are fixed px, so a stretched board loses its
            proportions. Inside 22rem it stays in the envelope it already renders
            at and needs no changes. The crónica track is capped too — a 776px
            line of match commentary is mostly trailing whitespace. */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,22rem)_minmax(0,42rem)] md:items-start md:justify-center">
          {/* Sticky so the board stays put while a long crónica scrolls past —
              that is the point of the split, not merely filling the width. */}
          <div className="card-surface p-4 md:sticky md:top-[calc(var(--topbar-h)+1.5rem)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                El campo
              </h3>
              <button
                className="btn-ghost px-3 py-1.5 text-sm"
                onClick={replayControl}
              >
                {playing ? '⏸ Pausa' : atEnd ? '↻ Repetición' : '▶ Reanudar'}
              </button>
            </div>
            <PitchBoard cell={ball?.params?.cell} side={ball?.side} />
          </div>

          <div className="card-surface flex flex-col p-4 md:max-h-[calc(100vh-var(--topbar-h)-3rem)]">
            <h3 className="mb-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Crónica
            </h3>
            {/* max-h-72 is the phone's vertical budget: it has to share one
                column with the board. Given its own column, the log fills it. */}
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm md:max-h-none md:min-h-0 md:flex-1">
              {outcome.log.map((e, i) => {
                const active = i === step
                return (
                  <li
                    key={i}
                    ref={active ? activeRef : null}
                    onClick={() => {
                      setPlaying(false)
                      setStep(i)
                    }}
                    className={`flex cursor-pointer gap-2 rounded px-1 transition ${
                      active ? 'bg-white/10 text-slate-100' : 'text-slate-300'
                    }`}
                  >
                    <span className="w-8 shrink-0 tabular-nums text-slate-500">
                      {e.minute}'
                    </span>
                    <span>{e.text}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <button className="btn-primary" onClick={() => setOutcome(null)}>
          Jugar otro
        </button>
      </div>
    )
  }

  return (
    // The picker is a short list of choices — app-measure. The outcome state
    // above is the wide one, where the pitch sits beside the crónica.
    <div className="app-measure flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Elige rival</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {DIFFICULTIES.map((d) => (
        <button
          key={d.id}
          disabled={busy}
          onClick={() => play(d.id)}
          className="card-surface flex items-center justify-between p-5 text-left transition md:hover:bg-pitch-700/80 md:hover:ring-white/10 active:scale-[0.99] disabled:opacity-50"
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
