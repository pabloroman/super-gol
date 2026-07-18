import { useState } from 'react'
import type { Difficulty } from '@/game/engine/types'
import { InteractiveMatch } from './play/InteractiveMatch'
import { HowToPlay } from './play/HowToPlay'

/**
 * Difficulty picker for the interactive match. The whole game is now turn-based and
 * server-authoritative (`InteractiveMatch` → the `play-match` Edge Function); picking a
 * rival just opens the board. The old one-shot simulation + replay scrubber is gone.
 */
const DIFFICULTIES: { id: Difficulty; label: string; blurb: string }[] = [
  { id: 'easy', label: 'Amistoso', blurb: 'Rival flojo. Ideal para empezar.' },
  { id: 'normal', label: 'Liga', blurb: 'Un rival de mitad de tabla.' },
  { id: 'hard', label: 'Champions', blurb: 'Los mejores. Máxima dificultad.' },
]

export function Play() {
  const [liveMatch, setLiveMatch] = useState<Difficulty | null>(null)
  const [showRules, setShowRules] = useState(false)

  if (liveMatch) {
    return <InteractiveMatch difficulty={liveMatch} onExit={() => setLiveMatch(null)} />
  }

  return (
    // The picker is a short list of choices — app-measure. The match itself opens the
    // wide board inside InteractiveMatch.
    <div className="app-measure flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Elige rival</h1>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="shrink-0 text-sm font-medium text-slate-400 transition md:hover:text-slate-200"
        >
          ¿Cómo se juega?
        </button>
      </div>
      {DIFFICULTIES.map((d) => (
        <button
          key={d.id}
          onClick={() => setLiveMatch(d.id)}
          className="card-surface flex items-center justify-between p-5 text-left transition md:hover:bg-pitch-700/80 md:hover:ring-white/10 active:scale-[0.99]"
        >
          <div>
            <div className="font-display text-xl font-bold">{d.label}</div>
            <div className="text-sm text-slate-400">{d.blurb}</div>
          </div>
          <span className="text-2xl">▶</span>
        </button>
      ))}

      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
    </div>
  )
}
