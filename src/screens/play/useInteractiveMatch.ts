import { useCallback, useEffect, useRef, useState } from 'react'
import { createRng, type Rng } from '@/game/engine/rng'
import { renderEs } from '@/game/engine/format-es'
import type { EngineEvent } from '@/game/engine/events'
import { apply, type MatchState, type Action, type Side } from '@/game/board'
import { chooseAction } from '@/game/board/ai'
import { startInteractiveMatch } from '@/game/interactiveEngine'
import type { Difficulty } from '@/game/engine/types'

export interface ChronicleLine {
  side: Side
  text: string
}

/** Pause between AI jugadas so the human can follow the away side's play. */
const AI_DELAY_MS = 650

/** Whose input the current phase needs; `null` at fulltime. */
function actorOf(state: MatchState): Side | null {
  return state.phase.kind === 'fulltime' ? null : (state.phase as { side: Side }).side
}

/**
 * Drives an interactive match on the client: the human acts through `act`, and the away
 * side is played automatically by the heuristic AI a beat later. All dice come from a
 * single persisted RNG (not authoritative — a preview path until the server owns it).
 */
export function useInteractiveMatch(difficulty: Difficulty) {
  const [state, setState] = useState<MatchState | null>(null)
  const [chronicle, setChronicle] = useState<ChronicleLine[]>([])
  const [opponent, setOpponent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const rng = useRef<Rng | null>(null)

  const record = useCallback((events: EngineEvent[]) => {
    if (events.length === 0) return
    setChronicle((prev) => [...prev, ...events.map((e) => ({ side: e.side, text: renderEs(e) }))])
  }, [])

  const start = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { state: initial, seed, opponent: name } = await startInteractiveMatch(difficulty)
      rng.current = createRng(seed)
      setOpponent(name)
      setChronicle([])
      setState(initial)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo empezar el partido')
    } finally {
      setLoading(false)
    }
  }, [difficulty])

  useEffect(() => {
    void start()
  }, [start])

  /**
   * Apply one action and fold in its events. Kept OUT of the setState updater on
   * purpose: React double-invokes updaters in StrictMode, so recording the chronicle
   * there would log every jugada twice. `apply` is pure, so computing next state here
   * from the current `state` is correct — the human acts one click at a time, and the
   * AI effect below re-derives from its own `state` dependency each tick.
   */
  const step = useCallback(
    (base: MatchState, action: Action) => {
      if (!rng.current) return
      const { state: next, events } = apply(base, action, rng.current)
      setState(next)
      record(events)
    },
    [record],
  )

  /** Apply one human action (the caller guarantees it is currently the human's turn). */
  const act = useCallback(
    (action: Action) => {
      if (state) step(state, action)
    },
    [state, step],
  )

  // The away side plays itself, one jugada per tick, until control returns to the human
  // or the match ends.
  useEffect(() => {
    if (!state || !rng.current || actorOf(state) !== 'away') return
    const id = setTimeout(() => step(state, chooseAction(state, rng.current!, state.difficulty)), AI_DELAY_MS)
    return () => clearTimeout(id)
  }, [state, step])

  const humanTurn = state != null && actorOf(state) === 'home'
  const finished = state != null && state.phase.kind === 'fulltime'

  return { state, chronicle, opponent, error, loading, act, restart: start, humanTurn, finished }
}
