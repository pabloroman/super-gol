// Spanish, user-facing messages for Supabase Auth (GoTrue) errors.
//
// GoTrue speaks English ("Invalid login credentials", "User already
// registered", …). The app is Spanish-only, so every auth failure must be
// translated before it reaches the screen — never surface `error.message` raw.
//
// We branch on `error.code` (a stable machine string like 'invalid_credentials';
// see @supabase/auth-js error-codes) and fall back to matching the English
// message for the few paths that arrive without a code (network wrappers, older
// edges). Anything unrecognised becomes a Spanish generic — the user still gets
// Spanish, never an English leak.
//
// `field` routes the message next to the offending input; absent means it is a
// form-level error shown at the bottom of the form.

export interface MappedAuthError {
  text: string
  field?: 'email' | 'password'
}

const INVALID_CREDENTIALS = 'Usuario o contraseña incorrectos.'
const GENERIC = 'No se ha podido completar la operación. Inténtalo de nuevo.'

function codeMessage(code: string): MappedAuthError | null {
  switch (code) {
    case 'invalid_credentials':
      return { text: INVALID_CREDENTIALS }
    case 'email_not_confirmed':
      return { text: 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.' }
    case 'user_already_exists':
    case 'email_exists':
    case 'identity_already_exists':
      return { text: 'Ya existe una cuenta con ese correo.', field: 'email' }
    case 'email_address_invalid':
      return { text: 'El correo no es válido.', field: 'email' }
    case 'email_address_not_authorized':
      return { text: 'Ese correo no está autorizado.', field: 'email' }
    case 'weak_password':
      return { text: 'La contraseña es demasiado débil. Usa al menos 6 caracteres.', field: 'password' }
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
    case 'over_sms_send_rate_limit':
      return { text: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' }
    case 'signup_disabled':
    case 'email_provider_disabled':
    case 'provider_disabled':
      return { text: 'El registro no está disponible en este momento.' }
    case 'user_banned':
      return { text: 'Esta cuenta está suspendida.' }
    case 'otp_expired':
      return { text: 'El enlace ha caducado. Solicita uno nuevo.' }
    case 'captcha_failed':
      return { text: 'No se ha podido verificar el captcha. Inténtalo de nuevo.' }
    case 'validation_failed':
      return { text: 'Revisa los datos introducidos.' }
    default:
      return null
  }
}

function messageFallback(message: string): MappedAuthError | null {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return { text: INVALID_CREDENTIALS }
  if (m.includes('email not confirmed')) {
    return { text: 'Debes confirmar tu correo antes de entrar. Revisa tu bandeja de entrada.' }
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return { text: 'Ya existe una cuenta con ese correo.', field: 'email' }
  }
  if (m.includes('password should be at least') || m.includes('weak password')) {
    return { text: 'La contraseña es demasiado débil. Usa al menos 6 caracteres.', field: 'password' }
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return { text: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.' }
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return { text: 'El correo no es válido.', field: 'email' }
  }
  return null
}

/** Translate any thrown auth/RPC error into a Spanish, user-facing message. */
export function authErrorMessage(err: unknown): MappedAuthError {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  if (typeof code === 'string') {
    const byCode = codeMessage(code)
    if (byCode) return byCode
  }
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (message) {
    const byMessage = messageFallback(message)
    if (byMessage) return byMessage
  }
  return { text: GENERIC }
}
