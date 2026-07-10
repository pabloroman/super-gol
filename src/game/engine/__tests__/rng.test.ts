import { describe, it, expect } from 'vitest'
import { createRng, seedFrom } from '@/game/engine/rng'

describe('rng', () => {
  it('is deterministic: same seed → same sequence', () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 20 }, () => a.next())
    const seqB = Array.from({ length: 20 }, () => b.next())
    expect(seqA).toEqual(seqB)
  })

  it('different seeds diverge', () => {
    const a = Array.from({ length: 10 }, (() => { const r = createRng(1); return () => r.next() })())
    const b = Array.from({ length: 10 }, (() => { const r = createRng(2); return () => r.next() })())
    expect(a).not.toEqual(b)
  })

  it('d6 stays within 1..6', () => {
    const r = createRng(99)
    for (let i = 0; i < 1000; i++) {
      const d = r.d6()
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(6)
    }
  })

  it('seedFrom is stable for the same parts', () => {
    expect(seedFrom('a', 1, 'b')).toBe(seedFrom('a', 1, 'b'))
    expect(seedFrom('a', 1)).not.toBe(seedFrom('a', 2))
  })
})
