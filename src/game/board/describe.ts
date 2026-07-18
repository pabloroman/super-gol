/**
 * Human-readable Spanish labels for actions, so the UI can render a legal-move menu.
 * Spanish leads (the rulebook terminology is canonical); a future English layer would
 * add a sibling renderer, exactly like the chronicle's `format-es`. Kept out of the
 * pure rules modules because it reads player names for display only.
 */

import type { Action } from './actions'
import type { MatchState } from './state'
import { occupants } from './derive'

const PASS_LABEL: Record<string, string> = { PD: 'Pase directo', PC: 'Pase corto', PL: 'Pase largo' }

/** A coarse grouping for laying the menu out (attack vs defence vs movement). */
export type ActionGroup = 'remate' | 'pase' | 'regate' | 'mover' | 'defensa' | 'saque'

export interface ActionLabel {
  label: string
  group: ActionGroup
}

/** Name plus board number, so two players sharing a surname stay distinguishable. */
function name(state: MatchState, id: string): string {
  const p = state.players[id]
  if (!p) return id
  const n = Number(id.slice(1))
  return n === 0 ? p.card.name : `${p.card.name} (${n})`
}

export function describeAction(state: MatchState, action: Action): ActionLabel {
  switch (action.kind) {
    case 'shot':
      return { label: action.shot === 'RM' ? 'Remate' : 'Disparo lejano', group: 'remate' }
    case 'pass':
      return { label: `${PASS_LABEL[action.pass]} a ${name(state, action.to)}`, group: 'pase' }
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
        return { label: mate ? `Relevo, dejar el balón a ${name(state, mate.id)}` : 'Relevo con balón', group: 'mover' }
      }
      return { label: `Mover a ${name(state, action.player)}`, group: 'mover' }
    }
    case 'anticipacion':
      return { label: `Anticipación (${name(state, action.defender)})`, group: 'defensa' }
    case 'robo':
      return { label: `Robo de balón (${name(state, action.defender)})`, group: 'defensa' }
    case 'decline':
      return { label: 'No hacer nada', group: 'defensa' }
    case 'robo_advance':
      return { label: 'Avanzar con el balón', group: 'mover' }
    case 'decline_advance':
      return { label: 'Quedarse', group: 'mover' }
    case 'recover':
      return { label: `Recuperar con ${name(state, action.player)}`, group: 'defensa' }
    case 'premove':
      return { label: `Colocar a ${name(state, action.player)}`, group: 'mover' }
    case 'premove_done':
      return { label: 'Sacar de portería', group: 'saque' }
    case 'keeper_pass':
      return { label: `${PASS_LABEL[action.pass]} a ${name(state, action.to)}`, group: 'saque' }
    case 'keeper_hueco':
      return { label: 'Saque al hueco', group: 'saque' }
    case 'place':
      return { label: 'Colocación', group: 'mover' }
    case 'placement_done':
      return { label: 'Empezar', group: 'saque' }
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
      return 'El rival se movió: puedes mover un jugador'
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
