import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { renderEs } from '@/game/engine/format-es'
import type { EngineEvent } from '@/game/engine/events'
import type { MatchState, Action, Side } from '@/game/board'
import type { AbilityKey } from '@/lib/types'
import type { GameMode } from '@/game/engine/types'
import {
  startMatch,
  resumeMatch,
  actMatch,
  resignMatch,
  MatchProtocolError,
  type MatchFinish,
} from '@/data/matchSession'

export interface ChronicleLine {
  side: Side
  text: string
}

/**
 * A goal just went in, for the celebration overlay. `side` is the scoring team,
 * `scorer` the shooter's name (null for an own goal, which concedes via a
 * `turnover` event and carries no scorer). `nonce` bumps per goal so the overlay
 * re-fires on back-to-back goals by the same side.
 */
export interface GoalFlash {
  side: Side
  scorer: string | null
  nonce: number
}

/** The most recent contested roll surfaced to the dice reveal. `total` lets the UI
 *  reconstruct the rulebook breakdown; `ability` labels which factor decided it. */
export interface Roll {
  dice: number[]
  total: number
  success: boolean
  ability?: AbilityKey
}

/** Pace between the away side's jugadas so the human can read its play. Two tiers:
 *  a plain step between ordinary AI jugadas, and a longer hold after a jugada that
 *  surfaced a contested dice roll (steal, shot, anticipación…) so its ✓/✗ reveal and
 *  crónica line linger before the next crank flips the dice HUD back to spinning. */
const AI_STEP_MS = 850
const AI_ROLL_HOLD_MS = 1600

/** Whose input the current phase needs; `null` at fulltime. */
function actorOf(state: MatchState): Side | null {
  return state.phase.kind === 'fulltime' ? null : (state.phase as { side: Side }).side
}

function errMessage(err: unknown): string {
  if (err instanceof MatchProtocolError) {
    switch (err.code) {
      case 'no_active_session':
        return 'No hay ningún partido en curso'
      case 'active_session':
        return 'Ya tienes un partido en curso'
      default:
        return 'Se perdió la conexión con el partido'
    }
  }
  return err instanceof Error ? err.message : 'No se pudo jugar el partido'
}

/**
 * Drives an interactive match against the SERVER: every jugada is one authenticated
 * round trip through the `play-match` Edge Function (`@/data/matchSession`). The client
 * never rolls a die or sends state back — it sends an action id (or nothing, to crank the
 * AI's own turn) plus the `ply` it last saw, and the server returns the next snapshot.
 * That is what makes the coins un-forgeable across the ~100 round trips of a full match.
 *
 * `cursor` (sessionId + last-seen ply) and `busy` (the in-flight guard) live in refs so
 * the async crank/act read the latest without re-subscribing; the React mirrors below
 * are only for rendering.
 */
export function useInteractiveMatch(mode: GameMode) {
  const { refreshProfile } = useAuth()
  const [state, setState] = useState<MatchState | null>(null)
  const [legal, setLegal] = useState<Action[]>([])
  const [chronicle, setChronicle] = useState<ChronicleLine[]>([])
  const [opponent, setOpponent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  /** A jugada round trip is in flight — the dice are rolling; the action bar is locked. */
  const [pending, setPending] = useState(false)
  /** The paid, server-defined result — present only once the match has finished. */
  const [finish, setFinish] = useState<MatchFinish | null>(null)
  /** The most recent contested roll, for the dice reveal + breakdown (null before any). */
  const [lastRoll, setLastRoll] = useState<Roll | null>(null)
  /** The last goal, for the celebration overlay; null while none is pending. */
  const [goalFlash, setGoalFlash] = useState<GoalFlash | null>(null)

  const cursor = useRef<{ sessionId: string; ply: number } | null>(null)
  const busy = useRef(false)
  /** The score we last folded, to detect a goal by diff (own goals emit no `goal` event). */
  const prevScore = useRef<{ home: number; away: number }>({ home: 0, away: 0 })
  /** Whether the last folded jugada surfaced a contested roll — the next AI crank holds
   *  longer (`AI_ROLL_HOLD_MS`) so the dice reveal can be read. */
  const lastFoldHadRoll = useRef(false)

  /**
   * Fold a snapshot into state. An `act` returns only the NEW events → `mode: 'append'`.
   * A `start`/`resume` returns the WHOLE log (the server replays it so a refresh restores
   * the crónica) → `mode: 'replace'`, or it would pile the full history on top of itself
   * (and a StrictMode double-mount would double it). `sessionId` is absent on an `act`.
   */
  const applySnapshot = useCallback(
    (
      snap: { sessionId?: string; ply: number; state: MatchState; legal: Action[]; events: EngineEvent[] },
      mode: 'append' | 'replace' = 'append',
    ) => {
      cursor.current = { sessionId: snap.sessionId ?? cursor.current!.sessionId, ply: snap.ply }
      setState(snap.state)
      setLegal(snap.legal)
      const lines = snap.events.map((e) => ({ side: e.side, text: renderEs(e) }))
      if (mode === 'replace') setChronicle(lines)
      else if (lines.length > 0) setChronicle((prev) => [...prev, ...lines])
      // Surface the last actual roll in this batch so the dice HUD can reveal real faces,
      // and remember whether this fold rolled at all so the next AI crank can hold longer.
      lastFoldHadRoll.current = false
      for (let i = snap.events.length - 1; i >= 0; i--) {
        const p = snap.events[i].params
        if (p.dice && p.dice.length > 0) {
          setLastRoll({
            dice: p.dice,
            total: p.total ?? 0,
            success: p.success === true,
            ability: p.ability,
          })
          lastFoldHadRoll.current = true
          break
        }
      }
      // A goal is a score change, not the `goal` event: an own goal (failed cesión)
      // concedes with a `turnover` event and no `goal` one, so we diff the score. On a
      // `replace` (start/resume replays the whole log) we only re-baseline — celebrating
      // a mid-match refresh's already-scored goals would be wrong.
      const prev = prevScore.current
      if (mode === 'append') {
        const scored: Side | null =
          snap.state.score.home > prev.home
            ? 'home'
            : snap.state.score.away > prev.away
              ? 'away'
              : null
        if (scored) {
          // The scorer's name comes from the `goal` event when there is one (a proper
          // shot); an own goal has none, so it stays null.
          const goal = snap.events.find((e) => e.type === 'goal' && e.side === scored)
          setGoalFlash((f) => ({ side: scored, scorer: goal?.params.player ?? null, nonce: (f?.nonce ?? 0) + 1 }))
        }
      }
      prevScore.current = snap.state.score
    },
    [],
  )

  const clearGoal = useCallback(() => setGoalFlash(null), [])

  const start = useCallback(async () => {
    // Guard concurrent starts: a StrictMode double-mount would otherwise fire two starts,
    // each creating-or-resuming a session (the second racing the first's insert).
    if (busy.current) return
    busy.current = true
    setLoading(true)
    setError(null)
    setFinish(null)
    setChronicle([])
    setLastRoll(null)
    setGoalFlash(null)
    cursor.current = null
    prevScore.current = { home: 0, away: 0 }
    try {
      // One live session at a time (the anti-farming spine): a start that collides with an
      // existing session resumes it rather than clobbering it — which also makes a mid-match
      // refresh a plain resume.
      let snap
      try {
        snap = await startMatch(mode)
      } catch (err) {
        if (err instanceof MatchProtocolError && err.code === 'active_session') {
          snap = await resumeMatch()
        } else throw err
      }
      setOpponent(snap.opponent)
      applySnapshot(snap, 'replace')
    } catch (err) {
      setError(errMessage(err))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [mode, applySnapshot])

  useEffect(() => {
    void start()
  }, [start])

  /** One jugada. `action` present = the human acts; omitted = crank the AI's own turn. */
  const advance = useCallback(
    async (action?: Action) => {
      const cur = cursor.current
      if (!cur || busy.current) return
      busy.current = true
      setPending(true)
      try {
        const res = await actMatch(cur.sessionId, cur.ply, action)
        applySnapshot(res)
        if (res.outcome) {
          setFinish(res.outcome)
          await refreshProfile()
        }
      } catch (err) {
        // A stale ply means our cursor drifted (a double-submit, or another tab advanced the
        // same session): re-read the authoritative snapshot rather than surfacing an error.
        if (err instanceof MatchProtocolError && err.code === 'stale_ply') {
          try {
            applySnapshot(await resumeMatch(), 'replace')
          } catch (resumeErr) {
            setError(errMessage(resumeErr))
          }
        } else {
          setError(errMessage(err))
        }
      } finally {
        busy.current = false
        setPending(false)
      }
    },
    [applySnapshot, refreshProfile],
  )

  // The away side plays itself: one crank per away ply, paced so the human can follow.
  // State changing re-runs this, so a whole away possession chains crank → crank → …
  // until control returns to the human or the match ends. The delay holds longer after a
  // jugada that rolled the dice (read fresh from the ref set during that same fold) so its
  // result lingers — this is what gives you time to read your own failed steal before the
  // AI continues. A pending goal celebration holds the match — the next crank waits until
  // the overlay is dismissed (`clearGoal` nulls `goalFlash`, re-running this effect).
  useEffect(() => {
    if (!state || actorOf(state) !== 'away' || goalFlash) return
    const delay = lastFoldHadRoll.current ? AI_ROLL_HOLD_MS : AI_STEP_MS
    const id = setTimeout(() => void advance(), delay)
    return () => clearTimeout(id)
  }, [state, advance, goalFlash])

  const act = useCallback(
    (action: Action) => {
      void advance(action)
    },
    [advance],
  )

  const resign = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    try {
      const { outcome } = await resignMatch()
      setFinish(outcome)
      setState((s) => (s ? { ...s, phase: { kind: 'fulltime' } } : s))
      await refreshProfile()
    } catch (err) {
      setError(errMessage(err))
    } finally {
      busy.current = false
      setPending(false)
    }
  }, [refreshProfile])

  const humanTurn = state != null && actorOf(state) === 'home' && !pending && finish == null
  const finished = finish != null || (state != null && state.phase.kind === 'fulltime')

  return {
    state,
    legal,
    chronicle,
    opponent,
    error,
    loading,
    pending,
    finish,
    lastRoll,
    goalFlash,
    clearGoal,
    act,
    resign,
    restart: start,
    humanTurn,
    finished,
  }
}
