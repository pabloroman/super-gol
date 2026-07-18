import { describe, expect, it } from 'vitest'
import { isValidUsername, usernameError } from '@/lib/username'

describe('username rules (Instagram-exact)', () => {
  it('accepts letters, digits, underscore and interior periods', () => {
    for (const ok of ['pablo', 'Pablo_95', 'a.b.c', 'coach.99', 'x'.repeat(30)]) {
      expect(usernameError(ok), ok).toBeNull()
    }
  })

  it('rejects blanks, out-of-range lengths and stray whitespace', () => {
    expect(isValidUsername('')).toBe(false)
    expect(isValidUsername('  ')).toBe(false)
    expect(isValidUsername('ab')).toBe(false) // < 3
    expect(isValidUsername('x'.repeat(31))).toBe(false) // > 30
    expect(isValidUsername('has space')).toBe(false)
  })

  it('rejects disallowed characters', () => {
    for (const bad of ['pab-lo', 'pablo!', 'pab@lo', 'pabló', '🙂name']) {
      expect(isValidUsername(bad), bad).toBe(false)
    }
  })

  it('rejects leading, trailing and consecutive periods', () => {
    expect(isValidUsername('.pablo')).toBe(false)
    expect(isValidUsername('pablo.')).toBe(false)
    expect(isValidUsername('pa..blo')).toBe(false)
  })

  it('trims before validating', () => {
    expect(usernameError('  pablo  ')).toBeNull()
  })
})
