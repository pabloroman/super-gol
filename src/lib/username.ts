// Username rules — the single source of truth for the public handle.
//
// The username is a PUBLIC identifier (it names a coach in 1v1 matchmaking), so
// it is required, unique (case-insensitively), and restricted to an
// Instagram-style character set. This validator is mirrored by the CHECK
// constraint and the handle_new_user trigger in
// supabase/migrations/0017_username_constraints.sql — keep the two in step. The
// DB is the authority (a forged client cannot bypass it); this file exists so
// the signup form can say something specific in Spanish before the round trip,
// exactly as username_available() lets it pre-check availability.
//
// Instagram-exact: letters, digits, '.', '_'; 3–30 chars; no leading, trailing
// or consecutive period.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

/** Same character class the SQL CHECK enforces. */
const ALLOWED = /^[A-Za-z0-9._]+$/

/**
 * Returns a Spanish, user-facing error for `raw`, or null when it is a valid
 * username. Messages are ordered most-specific-last so the first failing rule
 * wins.
 */
export function usernameError(raw: string): string | null {
  const u = raw.trim()
  if (!u) return 'Elige un nombre de usuario.'
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return `El usuario debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`
  }
  if (!ALLOWED.test(u)) {
    return 'El usuario solo puede tener letras, números, puntos y guiones bajos.'
  }
  if (u.startsWith('.') || u.endsWith('.')) {
    return 'El usuario no puede empezar ni acabar con un punto.'
  }
  if (u.includes('..')) {
    return 'El usuario no puede tener dos puntos seguidos.'
  }
  return null
}

export function isValidUsername(raw: string): boolean {
  return usernameError(raw) === null
}
