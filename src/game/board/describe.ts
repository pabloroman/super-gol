/**
 * Human-readable Spanish labels for actions, so the UI can render a legal-move menu.
 * Spanish leads (the rulebook terminology is canonical); a future English layer would
 * add a sibling renderer, exactly like the chronicle's `format-es`. Kept out of the
 * pure rules modules because it reads player names for display only.
 */

import type { AbilityKey } from '@/lib/types'
import { abilityValue } from '@/game/ratings'
import type { Action } from './actions'
import type { MatchState, PlayerId } from './state'
import { dorsal } from './state'
import { displayName, type EngineCard } from '../engine/types'
import { occupants } from './derive'

const PASS_LABEL: Record<string, string> = { PD: 'Pase directo', PC: 'Pase corto', PL: 'Pase largo' }

/** A coarse grouping for laying the menu out (attack vs defence vs movement). */
export type ActionGroup = 'remate' | 'pase' | 'regate' | 'mover' | 'defensa' | 'saque'

/** A referenced player, split so the UI can render the board number as a chip (matching
 *  the pitch pip) instead of a parenthesised «(NOMBRE (7))» string. `card` rides along so
 *  the chip can also show the same face the ficha does; it is the state's own embedded
 *  snapshot, not a catalog lookup. */
export interface ActionTarget {
  name: string
  dorsal: number
  card: EngineCard | null
}

export interface ActionLabel {
  label: string
  group: ActionGroup
  /** The player this action acts on/toward, when it has one (for the dorsal chip + name). */
  target?: ActionTarget
}

/** Name plus board number, split so the number can print as a chip that mirrors the pip. */
function target(state: MatchState, id: string): ActionTarget {
  const p = state.players[id]
  return { name: p ? displayName(p.card) : id, dorsal: dorsal(id), card: p?.card ?? null }
}

export function describeAction(state: MatchState, action: Action): ActionLabel {
  switch (action.kind) {
    case 'shot':
      return { label: action.shot === 'RM' ? 'Remate' : 'Disparo lejano', group: 'remate' }
    case 'pass':
      return { label: `${PASS_LABEL[action.pass]} a`, group: 'pase', target: target(state, action.to) }
    case 'hueco':
      return { label: `${action.pass === 'PL' ? 'Pase largo' : 'Pase corto'} al hueco`, group: 'pase' }
    case 'regate':
      return { label: 'Regate', group: 'regate' }
    case 'move': {
      // A relevo con balón by the carrier can hand the ball to the swapped teammate
      // ("dejándoselo a este último", page 4) — a distinct choice from carrying it in.
      if (action.handoff) {
        const mover = state.players[action.player]
        const mate = mover && occupants(state, action.to).find((o) => o.side === mover.side && o.id !== mover.id)
        return mate
          ? { label: 'Relevo, dejar el balón a', group: 'mover', target: target(state, mate.id) }
          : { label: 'Relevo con balón', group: 'mover' }
      }
      return { label: 'Mover a', group: 'mover', target: target(state, action.player) }
    }
    case 'anticipacion':
      return { label: 'Anticipación', group: 'defensa', target: target(state, action.defender) }
    case 'robo':
      return { label: 'Robo de balón', group: 'defensa', target: target(state, action.defender) }
    case 'decline':
      return { label: 'No hacer nada', group: 'defensa' }
    case 'robo_advance':
      return { label: 'Avanzar con el balón', group: 'mover' }
    case 'decline_advance':
      return { label: 'Quedarse', group: 'mover' }
    case 'recover':
      return { label: 'Recuperar con', group: 'defensa', target: target(state, action.player) }
    case 'premove':
      return { label: 'Colocar a', group: 'mover', target: target(state, action.player) }
    case 'premove_done':
      return { label: 'Sacar de portería', group: 'saque' }
    case 'keeper_pass':
      return { label: `${PASS_LABEL[action.pass]} a`, group: 'saque', target: target(state, action.to) }
    case 'keeper_hueco':
      return { label: 'Saque al hueco', group: 'saque' }
    case 'place':
      return { label: 'Colocación', group: 'mover' }
    case 'placement_done':
      return { label: 'Empezar', group: 'saque' }
  }
}

/**
 * The ability rating that resolves an action, plus the acting player's value for it,
 * so the UI can print a chip like «RM 3» next to the button. It mirrors the `rate(...)`
 * reads in `reducer.ts` exactly: shot → RM/DL, pase/pase al hueco corto → PC, largo → PL,
 * regate → RG, anticipación → A, robo → RB. The acting player is the ball carrier for the
 * attacking jugadas and `action.defender` for the defensive ones.
 *
 * Actions with no contested roll return null (no chip): the automatic pase directo, every
 * movimiento, and the keeper restart (page 11 forces the portero's PC/PL to 0). Because
 * this is only ever read for the human's own legal actions, it never surfaces an
 * opponent's rating.
 */
export function actionAbility(
  state: MatchState,
  action: Action,
): { key: AbilityKey; value: number } | null {
  const carrier = state.ball.carrier
  const of = (id: PlayerId | null, key: AbilityKey): { key: AbilityKey; value: number } | null => {
    const p = id ? state.players[id] : null
    return p ? { key, value: abilityValue(p.card, key) } : null
  }
  switch (action.kind) {
    case 'shot':
      return of(carrier, action.shot === 'RM' ? 'rm' : 'dl')
    case 'regate':
      return of(carrier, 'rg')
    case 'pass':
      return action.pass === 'PD' ? null : of(carrier, action.pass === 'PL' ? 'pl' : 'pc')
    case 'hueco':
      return of(carrier, action.pass === 'PL' ? 'pl' : 'pc')
    case 'anticipacion':
      return of(action.defender, 'a')
    case 'robo':
      return of(action.defender, 'rb')
    default:
      return null
  }
}

/** A short prompt for the human describing what the current phase asks of them. */
export function phasePrompt(state: MatchState): string {
  switch (state.phase.kind) {
    case 'kickoff':
      return 'Saque inicial: pase directo a un compañero'
    case 'attack':
      return 'Tienes el balón'
    case 'defend_move':
      return 'El rival se movió'
    case 'defend_interrupt':
      return 'Pase del rival a un jugador marcado: ¿intervienes?'
    case 'robo_advance':
      return 'Robo fallado: puedes avanzar con el balón'
    case 'recovery_pick':
      return 'Elige quién recupera el balón'
    case 'hueco_move':
      return 'Balón al hueco: mueve un jugador'
    case 'restart_move':
      return 'Puedes recolocar un jugador antes del saque'
    case 'keeper_restart':
      return 'Saca el portero'
    case 'fulltime':
      return 'Final del partido'
    case 'placement':
      return 'Coloca a tus jugadores'
  }
}
