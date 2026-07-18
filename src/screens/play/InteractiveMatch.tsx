import { useEffect, useMemo, useState } from 'react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { Coin } from '@/ui/Coin'
import type { AbilityKey } from '@/lib/types'
import { ABILITY_META } from '@/game/abilities'
import type { Action, Cell, MatchState, Side } from '@/game/board'
import { cellKey, occupants } from '@/game/board'
import { describeAction, phasePrompt, actionAbility, type ActionGroup } from '@/game/board/describe'
import type { Difficulty } from '@/game/engine/types'
import { contestBreakdown } from '@/game/engine/dice'
import { useInteractiveMatch, type Roll } from './useInteractiveMatch'
import { InteractivePitchBoard } from './InteractivePitchBoard'
import { HowToPlay } from './HowToPlay'
import { SquadPanel } from './SquadPanel'
import { GoalCelebration } from './GoalCelebration'

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
  const { act, resign, restart, humanTurn, finished, goalFlash, clearGoal } = match

  const [selected, setSelected] = useState<string | null>(null)
  const [huecoKey, setHuecoKey] = useState<string | null>(null)
  const [confirmResign, setConfirmResign] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showSquad, setShowSquad] = useState(false)

  // The home side "controls" the panel whenever the phase is waiting on home and the match
  // is live — INCLUDING while a home jugada is resolving (`pending`). Keeping the menu built
  // and mounted through that round trip (just dimmed/disabled) is what stops the panel from
  // collapsing to the "Resolviendo…" line and snapping back for the next jugada.
  const homeControls = state != null && phaseSideOf(state) === 'home' && finish == null
  const menu = useMemo<Menu>(
    () =>
      homeControls
        ? buildMenu(legal)
        : { buttons: [], moveSources: new Map(), huecoModes: [], advance: new Map() },
    [legal, homeControls],
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
      <div className="card-surface flex flex-wrap items-center justify-between gap-x-3 gap-y-2 p-3 text-sm">
        <span className="font-semibold">
          Tú {state.score.home} – {state.score.away} {opponent}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Turno {Math.min(state.turno + 1, 15)}/15</span>
          <button
            type="button"
            onClick={() => setShowSquad(true)}
            className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-200 transition md:hover:bg-white/10"
          >
            Plantilla
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="rounded-lg bg-white/5 px-2 py-1 text-xs font-medium text-slate-200 transition md:hover:bg-white/10"
          >
            ¿Cómo se juega?
          </button>
        </div>
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

              {/* Stable-height body so swaps between the away prose and the home menu — and the
                  menu dimming while a jugada resolves — cross-fade in place instead of the panel
                  collapsing and snapping back. */}
              <div className="min-h-[7rem] transition-opacity duration-200">
                {!homeControls && (
                  <p className="text-sm text-slate-400">El rival juega…</p>
                )}

                {homeControls && (
                  <div
                    className={`flex flex-col gap-2 transition-opacity duration-200 ${
                      pending ? 'pointer-events-none opacity-50' : 'opacity-100'
                    }`}
                    aria-busy={pending}
                  >
                    <p className="text-xs text-slate-400">
                      {pending ? 'Resolviendo la jugada…' : hint}
                    </p>
                    {menu.huecoModes.map((m) => (
                      <button
                        key={m.key}
                        disabled={pending}
                        className={`btn-ghost text-left ${m.key === huecoKey ? 'ring-1 ring-amber-300' : ''}`}
                        onClick={() => {
                          setSelected(null)
                          setHuecoKey((cur) => (cur === m.key ? null : m.key))
                        }}
                      >
                        <span className="flex-1">
                          {m.label}
                          {m.key === huecoKey ? ' — toca una casilla' : ''}
                        </span>
                        <AbilityChip ability={huecoAbility(state, m.targets)} />
                      </button>
                    ))}
                    {orderButtons(state, menu.buttons).map((a, i) => (
                      <button key={i} disabled={pending} className="btn-ghost text-left" onClick={() => run(a)}>
                        <span className="flex-1">{describeAction(state, a).label}</span>
                        <AbilityChip ability={actionAbility(state, a)} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  +{finish.coins_awarded} <Coin />
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

      <SquadPanel open={showSquad} onClose={() => setShowSquad(false)} state={state} />
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
      <GoalCelebration flash={goalFlash} onSeguir={clearGoal} />
    </div>
  )
}

/** The ability a "pase al hueco" mode shows — every target of the mode shares its pass type. */
function huecoAbility(
  state: MatchState,
  targets: Map<string, Action>,
): { key: AbilityKey; value: number } | null {
  for (const a of targets.values()) return actionAbility(state, a)
  return null
}

/** A compact rating badge («RM 3»): which ability decides an action, and the actor's value. */
function AbilityChip({ ability }: { ability: { key: AbilityKey; value: number } | null }) {
  if (!ability) return null
  return (
    <span className="shrink-0 rounded bg-black/30 px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums text-slate-200">
      {ABILITY_META[ability.key].abbr} {ability.value}
    </span>
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

/** Standard pip positions on a 3×3 grid (index 0–8) for each die face 1–6. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
}

/**
 * A single die drawn as the physical card's die: a white rounded square with black
 * pips (never a bare number). Kept neutral on reveal — the outcome is conveyed by the
 * breakdown's total and the ✓/✗, not by tinting the die. `spinning` bounces the tumble.
 */
function DieFace({ face, spinning }: { face: number; spinning?: boolean }) {
  const lit = new Set(PIPS[face] ?? [])
  return (
    <span
      className={`grid h-7 w-7 shrink-0 grid-cols-3 grid-rows-3 gap-px rounded-md bg-white p-1 shadow-sm ${
        spinning ? 'animate-bounce' : ''
      }`}
      aria-label={`Dado: ${face}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`m-auto h-1.5 w-1.5 rounded-full ${lit.has(i) ? 'bg-pitch-950' : 'bg-transparent'}`}
        />
      ))}
    </span>
  )
}

/** A summed term in the breakdown (a rating or the +5 constant), rendered like the rulebook. */
function Term({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-1 text-sm font-semibold tabular-nums text-slate-300">
      <span className="text-slate-500">+</span>
      {value}
    </span>
  )
}

/**
 * The dice HUD: while a jugada is in flight it tumbles (the client does not know the roll),
 * and lands on the real faces the server returns — the dice are the drama, so the reveal
 * arrives with the response rather than being faked optimistically. On reveal it spells out
 * the rulebook sum: ability · dice + [5] + rating = total (≥10), with the ✓/✗ marker.
 */
function DiceReveal({ rolling, roll }: { rolling: boolean; roll: Roll | null }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!rolling) return
    const id = setInterval(() => setTick((t) => t + 1), 90)
    return () => clearInterval(id)
  }, [rolling])

  if (rolling) {
    const faces = [((tick * 7) % 6) + 1, ((tick * 5 + 3) % 6) + 1]
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        {faces.map((f, i) => (
          <DieFace key={i} face={f} spinning />
        ))}
      </div>
    )
  }
  if (!roll || roll.dice.length === 0) return null

  const { bonus, rating, total, target } = contestBreakdown(roll.dice, roll.total)
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
      {roll.ability && (
        <span className="rounded bg-black/30 px-1.5 py-0.5 text-xs font-semibold leading-none text-slate-200">
          {ABILITY_META[roll.ability].abbr}
        </span>
      )}
      {roll.dice.map((f, i) => (
        <DieFace key={i} face={f} />
      ))}
      {bonus > 0 && <Term value={bonus} />}
      <Term value={rating} />
      <span className="text-sm font-semibold text-slate-500">=</span>
      <span
        className={`text-base font-bold tabular-nums ${roll.success ? 'text-grass-400' : 'text-red-400'}`}
      >
        {total}
      </span>
      <span className="text-xs font-medium tabular-nums text-slate-500">/{target}</span>
      {roll.success ? (
        <CheckIcon className="h-4 w-4 text-grass-400" aria-label="Éxito" />
      ) : (
        <XMarkIcon className="h-4 w-4 text-red-400" aria-label="Fallo" />
      )}
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
