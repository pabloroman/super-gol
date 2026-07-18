/**
 * Seeded pseudo-random number generator.
 *
 * The engine draws every random value from an `Rng` created from an integer seed, so a
 * match is fully reproducible. The server-authoritative board engine addresses a fresh
 * sub-seed per action (`seedFrom(seed, ply, action.kind)`), making each roll independently
 * reproducible and every jugada auditable from `(seed, ply, action)` alone.
 *
 * `mulberry32` is a tiny, well-distributed 32-bit generator — no dependencies.
 */

export interface Rng {
  /** Next float in [0, 1). */
  next(): number
  /** A six-sided die roll, 1..6. */
  d6(): number
  /** Integer in [0, n). */
  int(n: number): number
  /** Pick one element of a non-empty array. */
  pick<T>(xs: readonly T[]): T
  /** True with probability p (clamped to [0, 1]). */
  chance(p: number): boolean
}

export function createRng(seed: number): Rng {
  // Keep state as an unsigned 32-bit integer.
  let state = seed >>> 0
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (n: number): number => Math.floor(next() * n)
  return {
    next,
    int,
    d6: () => int(6) + 1,
    pick: <T>(xs: readonly T[]): T => xs[int(xs.length)],
    chance: (p: number) => next() < p,
  }
}

/**
 * Derive a stable 32-bit seed from arbitrary parts (strings/numbers). Uses an
 * FNV-1a style hash so, e.g., `seedFrom(matchId, difficulty)` is reproducible.
 */
export function seedFrom(...parts: (string | number)[]): number {
  let h = 0x811c9dc5
  const str = parts.join('|')
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
