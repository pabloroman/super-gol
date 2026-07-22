import { useState } from 'react'
import type { GameMode } from '@/game/engine/types'
import { InteractiveMatch } from './play/InteractiveMatch'
import { HowToPlay } from './play/HowToPlay'

/**
 * Mode picker for the interactive match. The whole game is now turn-based and
 * server-authoritative (`InteractiveMatch` → the `play-match` Edge Function); picking a
 * mode just opens the board. Amistoso is a weak rival for learning and pays no coins;
 * Competitivo is the best-decision rival that fields a squad under the 70-point cap.
 */
const MODES: { id: GameMode; label: string; blurb: string }[] = [
  { id: 'friendly', label: 'Amistoso', blurb: 'Aprende a jugar contra un rival fácil' },
  {
    id: 'competitive',
    label: 'Competitivo',
    blurb: 'Compite contra la máquina para ganar nuevas cartas',
  },
]

export function Play() {
  const [liveMatch, setLiveMatch] = useState<GameMode | null>(null)
  const [showRules, setShowRules] = useState(false)

  if (liveMatch) {
    return <InteractiveMatch mode={liveMatch} onExit={() => setLiveMatch(null)} />
  }

  return (
    // The picker is a short list of choices — app-measure. The match itself opens the
    // wide board inside InteractiveMatch.
    <div className="app-measure flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Elige modo</h1>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="shrink-0 text-sm font-medium text-slate-400 transition md:hover:text-slate-200"
        >
          ¿Cómo se juega?
        </button>
      </div>
      {MODES.map((d) => (
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
