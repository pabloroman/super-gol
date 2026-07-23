import type { MatchState } from '@/game/board'
import { dorsal } from '@/game/board'
import { displayName } from '@/game/engine/types'
import { ABILITY_META } from '@/game/abilities'
import { abilityValue } from '@/game/ratings'
import { naipeFactors } from '@/ui/naipe/factors'
import { Sheet } from '@/ui/Sheet'

/**
 * The "Plantilla" panel: your on-pitch XI with each player's defining factors, so two
 * strikers' RM (or any rating) can be compared before you decide where to send the ball —
 * the match board itself shows only shirt numbers.
 *
 * It reads the slim `EngineCard` embedded in each `MatchPlayer` (id/name/position/abilities),
 * which lacks the photo/club/cost/zone_grid a full `Naipe` needs, so it renders compact
 * factor chips instead. Factor selection reuses `naipeFactors` — the same keeper-vs-outfield
 * split and top-N density workaround the card face uses. Only your side is listed; the rival's
 * ratings stay hidden.
 */

const POSITION_ES: Record<string, string> = {
  GK: 'Portero',
  DF: 'Defensa',
  MF: 'Medio',
  FW: 'Delantero',
}

export function SquadPanel({
  open,
  onClose,
  state,
}: {
  open: boolean
  onClose: () => void
  state: MatchState
}) {
  const players = Object.values(state.players)
    .filter((p) => p.side === 'home')
    .sort((a, b) => dorsal(a.id) - dorsal(b.id))

  return (
    <Sheet open={open} onClose={onClose} title="Tu plantilla" size="wide">
      <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
        {players.map((p) => {
          const factors = naipeFactors(p.card)
          const hasBall = state.ball.carrier === p.id
          const position = p.card.position ? (POSITION_ES[p.card.position] ?? p.card.position) : null
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ${
                hasBall ? 'ring-1 ring-amber-300/70' : ''
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white font-bold tabular-nums text-pitch-950">
                {dorsal(p.id)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate font-semibold text-slate-100">{displayName(p.card)}</span>
                  {position && <span className="shrink-0 text-xs text-slate-400">{position}</span>}
                  {hasBall && (
                    <span className="shrink-0 text-xs font-semibold text-amber-300">• balón</span>
                  )}
                </div>
                {factors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {factors.map((k) => (
                      <span
                        key={k}
                        className="rounded bg-black/30 px-1.5 py-0.5 text-xs leading-none"
                      >
                        <span className="text-slate-400">{ABILITY_META[k].abbr}</span>{' '}
                        <span className="font-bold tabular-nums text-slate-100">
                          {abilityValue(p.card, k)}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}
