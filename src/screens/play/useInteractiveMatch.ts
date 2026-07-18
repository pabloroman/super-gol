import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { renderEs } from '@/game/engine/format-es'
import type { EngineEvent } from '@/game/engine/events'
import type { MatchState, Action, Side } from '@/game/board'
import type { AbilityKey } from '@/lib/types'
import type { Difficulty } from '@/game/engine/types'
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

/** The most recent contested roll surfaced to the dice reveal. `total` lets the UI
 *  reconstruct the rulebook breakdown; `ability` labels which factor decided it. */
export interface Roll {
  dice: number[]
  total: number
  success: boolean
  ability?: AbilityKey
}

/** Pace between the away side's jugadas so the human can read its play. */
const AI_DELAY_MS = 550

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
export function useInteractiveMatch(difficulty: Difficulty) {
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

  const cursor = useRef<{ sessionId: string; ply: number } | null>(null)
  const busy = useRef(false)

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
      // Surface the last actual roll in this batch so the dice HUD can reveal real faces.
      for (let i = snap.events.length - 1; i >= 0; i--) {
        const p = snap.events[i].params
        if (p.dice && p.dice.length > 0) {
          setLastRoll({
            dice: p.dice,
            total: p.total ?? 0,
            success: p.success === true,
            ability: p.ability,
          })
          break
        }
      }
    },
    [],
  )

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
    cursor.current = null
    try {
      // One live session at a time (the anti-farming spine): a start that collides with an
      // existing session resumes it rather than clobbering it — which also makes a mid-match
      // refresh a plain resume.
      let snap
      try {
        snap = await startMatch(difficulty)
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
  }, [difficulty, applySnapshot])

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
  // until control returns to the human or the match ends.
  useEffect(() => {
    if (!state || actorOf(state) !== 'away') return
    const id = setTimeout(() => void advance(), AI_DELAY_MS)
    return () => clearTimeout(id)
  }, [state, advance])

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
    act,
    resign,
    restart: start,
    humanTurn,
    finished,
  }
}
