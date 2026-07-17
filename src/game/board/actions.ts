/**
 * The action vocabulary of a jugada, and the RNG addressing scheme.
 *
 * `Action` is the closed set of things a player (human or AI) can do; `legalActions`
 * enumerates the subset legal in the current `Phase`, and `apply` consumes exactly
 * one. The same union drives the UI menu, the server's validation (an incoming action
 * must be a member of `legalActions(state)`) and the AI's option set — legality is
 * defined once. `actionKey` gives each action a stable string so that membership check
 * is a set lookup rather than a deep structural compare.
 *
 * Two rulebook actions are deliberately folded into more general kinds: a relevo is a
 * `move` whose destination holds a teammate, and a cesión is a `pass` whose target is
 * the mover's own keeper. `legalActions` decides when those are offered; `apply`
 * branches on the target.
 */

import type { Cell } from '../engine/pitch'
import type { PlayerId } from './state'
import { cellKey } from './derive'

export type PassKind = 'PD' | 'PC' | 'PL'
export type ShotKind = 'RM' | 'DL'

/** Why a robo is legal (rulebook page 9); each case rolls the same two dice + RB. */
export type RoboMode =
  /** Case 1: already marking the receiver of a just-completed pass al hombre. */
  | 'after-pass'
  /** Case 2: able to move, steps onto the ball holder to mark him al hombre. */
  | 'move-onto'
  /** Case 3: able to move, already al hombre on the holder, renounces the movement. */
  | 'renounce'

export type Action =
  // Placement (drag editor commits a whole arrangement; keeper stays put).
  | { kind: 'place'; cells: Record<PlayerId, Cell> }
  | { kind: 'placement_done' }
  // Attacker jugadas.
  | { kind: 'pass'; pass: PassKind; to: PlayerId }
  | { kind: 'hueco'; pass: Exclude<PassKind, 'PD'>; to: Cell }
  | { kind: 'regate' }
  | { kind: 'shot'; shot: ShotKind }
  /**
   * A movement. When `to` holds a teammate it is a relevo (they swap). `handoff` only
   * applies to a relevo con balón by the carrier: true leaves the ball with the swapped
   * teammate ("dejándoselo a este último", page 4), absent/false carries it along.
   */
  | { kind: 'move'; player: PlayerId; to: Cell; handoff?: boolean }
  // Defender reactions.
  | { kind: 'anticipacion'; defender: PlayerId }
  | { kind: 'robo'; defender: PlayerId; mode: RoboMode; to?: Cell }
  | { kind: 'decline' }
  // Mid-jugada micro-choices.
  | { kind: 'robo_advance'; to: Cell }
  | { kind: 'decline_advance' }
  | { kind: 'recover'; player: PlayerId }
  // Keeper restart (one premove per side, then the restart pass).
  | { kind: 'premove'; player: PlayerId; to: Cell }
  | { kind: 'premove_done' }
  | { kind: 'keeper_pass'; pass: PassKind; to: PlayerId }
  | { kind: 'keeper_hueco'; pass: Exclude<PassKind, 'PD'>; to: Cell }

/**
 * A stable identity for an action, so `legalActions(state)` membership is a set
 * lookup. Two actions are the same move iff their keys match.
 */
export function actionKey(a: Action): string {
  switch (a.kind) {
    case 'place':
      return `place:${Object.entries(a.cells)
        .sort(([x], [y]) => (x < y ? -1 : 1))
        .map(([id, c]) => `${id}@${cellKey(c)}`)
        .join('|')}`
    case 'placement_done':
    case 'regate':
    case 'decline':
    case 'decline_advance':
    case 'premove_done':
      return a.kind
    case 'pass':
      return `pass:${a.pass}:${a.to}`
    case 'hueco':
      return `hueco:${a.pass}:${cellKey(a.to)}`
    case 'shot':
      return `shot:${a.shot}`
    case 'move':
      return `move:${a.player}:${cellKey(a.to)}${a.handoff ? ':handoff' : ''}`
    case 'anticipacion':
      return `anticipacion:${a.defender}`
    case 'robo':
      return `robo:${a.defender}:${a.mode}${a.to ? `:${cellKey(a.to)}` : ''}`
    case 'robo_advance':
      return `robo_advance:${cellKey(a.to)}`
    case 'recover':
      return `recover:${a.player}`
    case 'premove':
      return `premove:${a.player}:${cellKey(a.to)}`
    case 'keeper_pass':
      return `keeper_pass:${a.pass}:${a.to}`
    case 'keeper_hueco':
      return `keeper_hueco:${a.pass}:${cellKey(a.to)}`
  }
}
