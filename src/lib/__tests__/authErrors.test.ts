import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '@/lib/authErrors'

/** A minimal stand-in for supabase-js AuthError (message + code). */
function authError(message: string, code?: string): Error & { code?: string } {
  return Object.assign(new Error(message), code ? { code } : {})
}

describe('authErrorMessage', () => {
  it('maps known GoTrue codes to Spanish', () => {
    expect(authErrorMessage(authError('Invalid login credentials', 'invalid_credentials')).text).toBe(
      'Usuario o contraseña incorrectos.',
    )
    expect(authErrorMessage(authError('Email not confirmed', 'email_not_confirmed')).text).toMatch(
      /confirmar tu correo/,
    )
  })

  it('routes field-specific errors to their input', () => {
    expect(authErrorMessage(authError('User already registered', 'user_already_exists'))).toEqual({
      text: 'Ya existe una cuenta con ese correo.',
      field: 'email',
    })
    expect(authErrorMessage(authError('weak', 'weak_password')).field).toBe('password')
  })

  it('falls back to matching the English message when no code is present', () => {
    expect(authErrorMessage(new Error('Invalid login credentials')).text).toBe(
      'Usuario o contraseña incorrectos.',
    )
    expect(authErrorMessage(new Error('Password should be at least 6 characters')).field).toBe('password')
    expect(authErrorMessage(new Error('email rate limit exceeded')).text).toMatch(/Demasiados intentos/)
  })

  it('never leaks English: unknown errors become a Spanish generic', () => {
    expect(authErrorMessage(new Error('some brand new server message')).text).toBe(
      'No se ha podido completar la operación. Inténtalo de nuevo.',
    )
    expect(authErrorMessage('{}').text).toBe('No se ha podido completar la operación. Inténtalo de nuevo.')
    expect(authErrorMessage(null).text).toMatch(/No se ha podido/)
  })
})
