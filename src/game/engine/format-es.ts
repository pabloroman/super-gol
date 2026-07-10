import { ABILITY_META } from '@/game/abilities'
import type { EngineEvent } from './events'

/**
 * Default Spanish renderer for chronicle events. This is the single place match
 * text is worded, so a future `format-en.ts` can mirror it without touching the
 * engine — and the Spanish rulebook terminology stays the source of truth.
 */

function ability(e: EngineEvent): string {
  return e.params.ability ? ABILITY_META[e.params.ability].abbr : ''
}

function player(e: EngineEvent): string {
  return e.params.player ?? 'Un jugador'
}

export function renderEs(e: EngineEvent): string {
  const p = player(e)
  switch (e.type) {
    case 'kickoff':
      return `Saque desde el centro. Mueve ${p}.`
    case 'pass':
      return `${p} combina con los suyos.`
    case 'dribble':
      return e.params.success
        ? `${p} se va en el regate (${ability(e)}).`
        : `${p} lo intenta en el regate pero lo frenan.`
    case 'shot':
      // Only emitted for an off-target shot.
      return `${p} dispara (${ability(e)}) y se va fuera.`
    case 'save':
      return `¡Paradón de ${p}! (${ability(e)}).`
    case 'goal':
      return `¡GOOOOL de ${p}! (${ability(e)}).`
    case 'interception':
      return `Anticipación (${ability(e)}); corta el balón la defensa.`
    case 'steal':
      return `Robo de balón (${ability(e)}); recupera la defensa.`
    case 'turnover':
      return `${p} pierde el balón.`
    case 'fulltime':
      return 'Final del partido.'
  }
}
