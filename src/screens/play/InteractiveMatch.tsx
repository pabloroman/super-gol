import { useEffect, useMemo, useState } from 'react'
import type { Action, Cell, MatchState, Side } from '@/game/board'
import { cellKey, occupants } from '@/game/board'
import { describeAction, phasePrompt, type ActionGroup } from '@/game/board/describe'
import type { Difficulty } from '@/game/engine/types'
import { useInteractiveMatch } from './useInteractiveMatch'
import { InteractivePitchBoard } from './InteractivePitchBoard'

/** A "pase/saque al hueco" of one pass type: tap one of its empty target cells to commit. */
interface HuecoMode {
  key: string
  label: string
  targets: Map<string, Action>
}

interface Menu {
  /** Discrete actions rendered as buttons (passes, shots, regate, defence, hand-off relevo). */
  buttons: Action[]
  /** playerId → (cellKey → move/premove): select the player, then tap a highlighted cell. */
  moveSources: Map<string, Map<string, Action>>
  /** Pase/saque al hueco, grouped by pass type; entering a mode highlights its cells. */
  huecoModes: HuecoMode[]
  /** cellKey → robo_advance (the carrier advancing one cell after a failed robo). */
  advance: Map<string, Action>
}

const HUECO_DISTANCE: Record<'PC' | 'PL', string> = { PC: 'corto', PL: 'largo' }

/** Order the button menu top-to-bottom by kind, so it reads the same every jugada. */
const GROUP_ORDER: ActionGroup[] = ['remate', 'pase', 'regate', 'defensa', 'saque', 'mover']

/**
 * Split the server's legal set into what the UI needs. Passes to named teammates, shots,
 * regate and the defender reactions are buttons; movements are a select-then-tap flow;
 * pases al hueco enter a tap-a-cell "mode". A relevo con balón hand-off (`move.handoff`)
 * would otherwise collide with the plain carry to the same cell in `moveSources`, so it is
 * pulled out as its own button — the choice "carry the ball / leave it" made explicit.
 */
function buildMenu(actions: Action[]): Menu {
  const moveSources = new Map<string, Map<string, Action>>()
  const advance = new Map<string, Action>()
  const huecoModes: HuecoMode[] = []
  const huecoByKey = new Map<string, HuecoMode>()
  const buttons: Action[] = []

  for (const a of actions) {
    if (a.kind === 'move' && a.handoff) {
      buttons.push(a)
    } else if (a.kind === 'move' || a.kind === 'premove') {
      const byCell = moveSources.get(a.player) ?? new Map<string, Action>()
      byCell.set(cellKey(a.to), a)
      moveSources.set(a.player, byCell)
    } else if (a.kind === 'robo_advance') {
      advance.set(cellKey(a.to), a)
    } else if (a.kind === 'hueco' || a.kind === 'keeper_hueco') {
      const key = `${a.kind}:${a.pass}`
      let mode = huecoByKey.get(key)
      if (!mode) {
        const verb = a.kind === 'keeper_hueco' ? 'Saque' : 'Pase'
        mode = { key, label: `${verb} ${HUECO_DISTANCE[a.pass]} al hueco`, targets: new Map() }
        huecoByKey.set(key, mode)
        huecoModes.push(mode)
      }
      mode.targets.set(cellKey(a.to), a)
    } else {
      buttons.push(a)
    }
  }
  return { buttons, moveSources, huecoModes, advance }
}

/** Whose input the current phase needs (null at fulltime), for the panel copy. */
function phaseSideOf(state: MatchState): Side | null {
  return state.phase.kind === 'fulltime' ? null : (state.phase as { side: Side }).side
}

export function InteractiveMatch({
  difficulty,
  onExit,
}: {
  difficulty: Difficulty
  onExit: () => void
}) {
  const match = useInteractiveMatch(difficulty)
  const { state, legal, chronicle, opponent, error, loading, pending, finish, lastRoll } = match
  const { act, resign, restart, humanTurn, finished } = match

  const [selected, setSelected] = useState<string | null>(null)
  const [huecoKey, setHuecoKey] = useState<string | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)

  const menu = useMemo<Menu>(
    () =>
      humanTurn
        ? buildMenu(legal)
        : { buttons: [], moveSources: new Map(), huecoModes: [], advance: new Map() },
    [legal, humanTurn],
  )

  // A new jugada clears any in-progress selection so a stale player/hueco pick can't fire.
  useEffect(() => {
    setSelected(null)
    setHuecoKey(null)
  }, [legal])

  if (loading) return <p className="text-center text-slate-400">Preparando el partido…</p>
  if (error && !state) {
    return (
      <div className="app-measure flex flex-col gap-3 text-center">
        <p className="text-red-400">{error}</p>
        <button className="btn-ghost" onClick={onExit}>
          Volver
        </button>
      </div>
    )
  }
  if (!state) return null

  const activeHueco = menu.huecoModes.find((m) => m.key === huecoKey) ?? null
  const highlight = new Set<string>()
  if (humanTurn) {
    if (menu.advance.size > 0) for (const k of menu.advance.keys()) highlight.add(k)
    else if (activeHueco) for (const k of activeHueco.targets.keys()) highlight.add(k)
    else if (selected) for (const k of menu.moveSources.get(selected)?.keys() ?? []) highlight.add(k)
  }

  // One handler for every board tap (empty square or any pip). Priority: a mid-jugada
  // advance, then an active hueco target, then a move for the selected player — and only
  // if none apply, (de)select a home player standing here who has legal moves. This is what
  // lets a tap on an OPPONENT's pip execute a move onto that cell (marking him al hombre).
  function onCell(cell: Cell) {
    if (!humanTurn) return
    const key = cellKey(cell)
    const adv = menu.advance.get(key)
    if (adv) return void act(adv)
    if (activeHueco) {
      const hueco = activeHueco.targets.get(key)
      if (hueco) {
        setHuecoKey(null)
        act(hueco)
      }
      return
    }
    if (selected) {
      const move = menu.moveSources.get(selected)?.get(key)
      if (move) {
        setSelected(null)
        return void act(move)
      }
    }
    // `state` is guaranteed non-null past the render guard above; the closure just loses the narrowing.
    const mover = occupants(state!, cell).find((p) => menu.moveSources.has(p.id))
    if (mover) {
      setHuecoKey(null)
      setSelected((cur) => (cur === mover.id ? null : mover.id))
    }
  }

  function run(action: Action) {
    setSelected(null)
    setHuecoKey(null)
    act(action)
  }

  const phaseSide = phaseSideOf(state)
  const canMove = menu.moveSources.size > 0
  const hint = menu.advance.size > 0
    ? 'Toca una casilla resaltada para avanzar con el balón.'
    : activeHueco
      ? 'Toca una casilla vacía resaltada para el pase al hueco.'
      : selected
        ? 'Toca una casilla resaltada para mover.'
        : canMove
          ? 'Toca a un jugador para moverlo, o elige una acción.'
          : 'Elige una acción.'

  const score = finish ?? { gf: state.score.home, ga: state.score.away, result: undefined }

  return (
    <div className="flex flex-col gap-4">
      <div className="card-surface flex items-center justify-between p-3 text-sm">
        <span className="font-semibold">
          Tú {state.score.home} – {state.score.away} {opponent}
        </span>
        <span className="text-slate-400">Turno {Math.min(state.turno + 1, 15)}/15</span>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] md:items-start">
        <div className="card-surface p-3">
          <InteractivePitchBoard
            state={state}
            selectedPlayer={selected}
            highlight={highlight}
            onCell={onCell}
          />
        </div>

        <div className="flex flex-col gap-3">
          {!finished && (
            <div className="card-surface p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-slate-200">{phasePrompt(state)}</p>
                <DiceReveal rolling={pending} roll={lastRoll} />
              </div>

              {phaseSide === 'away' && !pending && (
                <p className="text-sm text-slate-400">El rival juega…</p>
              )}
              {pending && phaseSide !== 'home' && (
                <p className="text-sm text-slate-400">El rival juega…</p>
              )}
              {pending && phaseSide === 'home' && (
                <p className="text-sm text-slate-400">Resolviendo la jugada…</p>
              )}

              {humanTurn && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-400">{hint}</p>
                  {menu.huecoModes.map((m) => (
                    <button
                      key={m.key}
                      className={`btn-ghost text-left ${m.key === huecoKey ? 'ring-1 ring-amber-300' : ''}`}
                      onClick={() => {
                        setSelected(null)
                        setHuecoKey((cur) => (cur === m.key ? null : m.key))
                      }}
                    >
                      {m.label}
                      {m.key === huecoKey ? ' — toca una casilla' : ''}
                    </button>
                  ))}
                  {orderButtons(state, menu.buttons).map((a, i) => (
                    <button key={i} className="btn-ghost text-left" onClick={() => run(a)}>
                      {describeAction(state, a).label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!finished && (
            <div className="flex justify-end">
              {confirmResign ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">¿Rendirte? Cuenta como derrota.</span>
                  <button className="btn-ghost px-3 py-1 text-red-400" onClick={resign} disabled={pending}>
                    Sí, rendirse
                  </button>
                  <button className="btn-ghost px-3 py-1" onClick={() => setConfirmResign(false)}>
                    No
                  </button>
                </div>
              ) : (
                <button
                  className="text-sm text-slate-500 md:hover:text-slate-300"
                  onClick={() => setConfirmResign(true)}
                >
                  Rendirse
                </button>
              )}
            </div>
          )}

          {finished && (
            <div className="card-surface p-4 text-center">
              <p className="font-display text-2xl font-bold">
                {resultTitle(score.result, state)}
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {score.gf} – {score.ga}
              </p>
              {finish && (
                <p className="mt-2 inline-block rounded-full bg-black/40 px-4 py-1 font-bold text-rare">
                  +{finish.coins_awarded} 🪙
                </p>
              )}
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-3 flex gap-2">
                <button className="btn-primary flex-1" onClick={restart}>
                  Jugar otro
                </button>
                <button className="btn-ghost flex-1" onClick={onExit}>
                  Salir
                </button>
              </div>
            </div>
          )}

          <Chronicle lines={chronicle} />
        </div>
      </div>
    </div>
  )
}

/** Stable top-to-bottom ordering of the button menu by action group. */
function orderButtons(state: MatchState, buttons: Action[]): Action[] {
  return [...buttons].sort(
    (a, b) => GROUP_ORDER.indexOf(describeAction(state, a).group) - GROUP_ORDER.indexOf(describeAction(state, b).group),
  )
}

function resultTitle(result: 'win' | 'loss' | 'draw' | undefined, state: MatchState): string {
  const r = result ?? (state.score.home > state.score.away ? 'win' : state.score.home < state.score.away ? 'loss' : 'draw')
  return r === 'win' ? '¡Victoria!' : r === 'loss' ? 'Derrota' : 'Empate'
}

/** A single die face; tinted green/red on reveal, tumbling while the roll is in flight. */
function Die({ face, spinning, tone }: { face: number; spinning?: boolean; tone?: 'ok' | 'bad' }) {
  const color =
    tone === 'ok'
      ? 'bg-grass-500 text-white'
      : tone === 'bad'
        ? 'bg-red-500/85 text-white'
        : 'bg-white text-pitch-950'
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-md text-base font-bold tabular-nums ${color} ${
        spinning ? 'animate-bounce' : ''
      }`}
    >
      {face}
    </span>
  )
}

/**
 * The dice HUD: while a jugada is in flight it tumbles (the client does not know the roll),
 * and lands on the real faces the server returns — the dice are the drama, so the reveal
 * arrives with the response rather than being faked optimistically.
 */
function DiceReveal({
  rolling,
  roll,
}: {
  rolling: boolean
  roll: { dice: number[]; success: boolean } | null
}) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!rolling) return
    const id = setInterval(() => setTick((t) => t + 1), 90)
    return () => clearInterval(id)
  }, [rolling])

  if (rolling) {
    const faces = [((tick * 7) % 6) + 1, ((tick * 5 + 3) % 6) + 1]
    return (
      <div className="flex shrink-0 gap-1.5">
        {faces.map((f, i) => (
          <Die key={i} face={f} spinning />
        ))}
      </div>
    )
  }
  if (!roll || roll.dice.length === 0) return null
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {roll.dice.map((f, i) => (
        <Die key={i} face={f} tone={roll.success ? 'ok' : 'bad'} />
      ))}
      <span className={roll.success ? 'text-grass-400' : 'text-red-400'}>{roll.success ? '✓' : '✗'}</span>
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
