import { useMemo, useState } from 'react'
import type { Action, Cell } from '@/game/board'
import { legalActions, cellKey } from '@/game/board'
import { describeAction, phasePrompt } from '@/game/board/describe'
import type { Difficulty } from '@/game/engine/types'
import { useInteractiveMatch } from './useInteractiveMatch'
import { InteractivePitchBoard } from './InteractivePitchBoard'

/** Kinds the human drives by tapping a destination cell rather than a button. */
const SPATIAL = new Set(['move', 'premove'])

interface Menu {
  buttons: Action[]
  /** playerId → (cellKey → move/premove action) for the tap-to-move flow. */
  spatial: Map<string, Map<string, Action>>
  /** cellKey → robo_advance action (the carrier advancing after a failed robo). */
  advance: Map<string, Action>
}

/** Split the legal set into button actions and the spatial (tap-a-cell) ones. */
function buildMenu(actions: Action[]): Menu {
  const spatial = new Map<string, Map<string, Action>>()
  const advance = new Map<string, Action>()
  const buttons: Action[] = []
  for (const a of actions) {
    if (SPATIAL.has(a.kind)) {
      const move = a as Extract<Action, { kind: 'move' | 'premove' }>
      const byCell = spatial.get(move.player) ?? new Map<string, Action>()
      byCell.set(cellKey(move.to), a)
      spatial.set(move.player, byCell)
    } else if (a.kind === 'robo_advance') {
      advance.set(cellKey(a.to), a)
    } else if (a.kind === 'hueco' || a.kind === 'keeper_hueco') {
      // Omitted from the human menu in this first slice (the AI still uses them).
    } else {
      buttons.push(a)
    }
  }
  return { buttons, spatial, advance }
}

export function InteractiveMatch({
  difficulty,
  onExit,
}: {
  difficulty: Difficulty
  onExit: () => void
}) {
  const { state, chronicle, opponent, error, loading, act, restart, humanTurn, finished } =
    useInteractiveMatch(difficulty)
  const [selected, setSelected] = useState<string | null>(null)

  const menu = useMemo<Menu>(
    () => (state && humanTurn ? buildMenu(legalActions(state)) : { buttons: [], spatial: new Map(), advance: new Map() }),
    [state, humanTurn],
  )

  if (loading) return <p className="text-center text-slate-400">Preparando el partido…</p>
  if (error) {
    return (
      <div className="app-measure flex flex-col gap-3 text-center">
        <p className="text-red-400">{error}</p>
        <button className="btn-ghost" onClick={onExit}>Volver</button>
      </div>
    )
  }
  if (!state) return null

  const highlight = new Set<string>()
  if (humanTurn) {
    if (menu.advance.size > 0) for (const k of menu.advance.keys()) highlight.add(k)
    else if (selected) for (const k of menu.spatial.get(selected)?.keys() ?? []) highlight.add(k)
  }

  function onSelectPlayer(id: string) {
    if (!humanTurn) return
    setSelected((cur) => (cur === id ? null : menu.spatial.has(id) ? id : cur))
  }

  function onSelectCell(cell: Cell) {
    if (!humanTurn) return
    const key = cellKey(cell)
    const adv = menu.advance.get(key)
    if (adv) return void act(adv)
    if (selected) {
      const move = menu.spatial.get(selected)?.get(key)
      if (move) {
        act(move)
        setSelected(null)
      }
    }
  }

  function run(action: Action) {
    act(action)
    setSelected(null)
  }

  const canMove = menu.spatial.size > 0

  return (
    <div className="flex flex-col gap-4">
      <div className="card-surface flex items-center justify-between p-3 text-sm">
        <span className="font-semibold">Tú {state.score.home} – {state.score.away} {opponent}</span>
        <span className="text-slate-400">Turno {state.turno + 1}/15</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
        <div className="card-surface p-3">
          <InteractivePitchBoard
            state={state}
            selectedPlayer={selected}
            highlight={highlight}
            onSelectPlayer={onSelectPlayer}
            onSelectCell={onSelectCell}
          />
        </div>

        <div className="flex flex-col gap-3">
          {!finished && (
            <div className="card-surface p-4">
              <p className="mb-3 text-sm font-semibold text-slate-200">{phasePrompt(state)}</p>
              {!humanTurn && <p className="text-sm text-slate-400">El rival juega…</p>}
              {humanTurn && (
                <div className="flex flex-col gap-2">
                  {canMove && (
                    <p className="text-xs text-slate-400">
                      {menu.advance.size > 0
                        ? 'Toca una casilla resaltada para avanzar.'
                        : selected
                          ? 'Toca una casilla resaltada para mover.'
                          : 'Toca a un jugador para moverlo, o elige una acción.'}
                    </p>
                  )}
                  {menu.buttons.map((a, i) => (
                    <button key={i} className="btn-ghost text-left" onClick={() => run(a)}>
                      {describeAction(state, a).label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {finished && (
            <div className="card-surface p-4 text-center">
              <p className="font-display text-2xl font-bold">
                {state.score.home > state.score.away
                  ? '¡Victoria!'
                  : state.score.home < state.score.away
                    ? 'Derrota'
                    : 'Empate'}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {state.score.home} – {state.score.away}
              </p>
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1" onClick={restart}>Jugar otro</button>
                <button className="btn-ghost flex-1" onClick={onExit}>Salir</button>
              </div>
            </div>
          )}

          <Chronicle lines={chronicle} />
        </div>
      </div>
    </div>
  )
}

function Chronicle({ lines }: { lines: { text: string }[] }) {
  const recent = lines.slice(-8).reverse()
  if (recent.length === 0) return null
  return (
    <div className="card-surface p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Crónica</h3>
      <ul className="space-y-1 text-sm text-slate-300">
        {recent.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </div>
  )
}
