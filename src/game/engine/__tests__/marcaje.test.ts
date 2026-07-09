import { describe, it, expect } from 'vitest'
import {
  afterPassCompleted,
  afterAnticipacion,
  afterRobo,
  afterRegate,
  forDice,
} from '@/game/engine/marcaje'

describe('marcaje transitions', () => {
  it('a completed pass leaves the existing marks unchanged (pages 6–7)', () => {
    expect(afterPassCompleted('MH')).toEqual({ possession: 'attacker', carrier: 'MH' })
    expect(afterPassCompleted('MZ')).toEqual({ possession: 'attacker', carrier: 'MZ' })
  })

  it('a successful anticipación wins the ball; a failed one frees the attacker (page 8)', () => {
    expect(afterAnticipacion(true)).toEqual({ possession: 'defender', carrier: 'LIBRE' })
    expect(afterAnticipacion(false)).toEqual({ possession: 'attacker', carrier: 'LIBRE' })
  })

  it('a successful robo wins the ball marking al hombre; a failed one frees the carrier (page 9)', () => {
    expect(afterRobo(true)).toEqual({ possession: 'defender', carrier: 'MH' })
    expect(afterRobo(false)).toEqual({ possession: 'attacker', carrier: 'LIBRE' })
  })

  it('a successful regate frees the carrier; a failed one drops it to zona (pages 9–10)', () => {
    expect(afterRegate(true)).toEqual({ possession: 'attacker', carrier: 'LIBRE' })
    expect(afterRegate(false)).toEqual({ possession: 'attacker', carrier: 'MZ' })
  })

  it('LIBRE collapses to SM for dice purposes', () => {
    expect(forDice('LIBRE')).toBe('SM')
    expect(forDice('MH')).toBe('MH')
    expect(forDice('MZ')).toBe('MZ')
  })
})
