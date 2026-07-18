import { useEffect, useState, type FormEvent } from 'react'
import { requireSupabase } from '@/lib/supabase'
import { USERNAME_MAX, USERNAME_MIN, usernameError } from '@/lib/username'
import { authErrorMessage } from '@/lib/authErrors'

// Supabase's default minimum password length. Mirrored client-side so a short
// password fails with a Spanish hint before the round trip, rather than coming
// back as GoTrue's English `weak_password`.
const PASSWORD_MIN = 6
const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres.`
const USERNAME_HINT = `Entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres · letras, números, punto y guion bajo.`

/** Per-field validation/error messages, shown next to the offending input. */
type FieldErrors = { username?: string; email?: string; password?: string }

/**
 * Where Supabase should send the user after they confirm their email. We pass
 * this explicitly on every auth call so the app — not the dashboard Site URL —
 * decides the landing origin. Combined with supabase-js `detectSessionInUrl`
 * (on by default), a successful confirmation lands back here and logs the user
 * in automatically. If this is omitted, Supabase falls back to the project's
 * Site URL, which is easy to leave pointing at a protected preview domain.
 */
function emailRedirectTo(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return `${window.location.origin}/`
}

/**
 * Read an auth error handed back in the URL hash, e.g.
 * `#error=access_denied&error_code=otp_expired&error_description=...`.
 * Supabase appends this when an email link is invalid or expired. We surface it
 * (and strip it from the URL) so the user gets a Spanish explanation and a
 * resend option instead of a bare login form.
 */
function readHashError(): { code: string | null; description: string | null } | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash) return null
  const params = new URLSearchParams(hash)
  if (!params.get('error') && !params.get('error_code')) return null
  const result = {
    code: params.get('error_code'),
    description: params.get('error_description'),
  }
  // Clean the hash so a refresh doesn't re-show the error.
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  return result
}

export function Login({
  initialMode = 'signin',
  onBack,
}: {
  initialMode?: 'signin' | 'signup'
  onBack?: () => void
} = {}) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  // Sign-in accepts either a username or an email in one field.
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  // Form-level error (auth failures that aren't tied to one field). Always
  // Spanish — see authErrorMessage.
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [expiredLink, setExpiredLink] = useState(false)

  useEffect(() => {
    const hashError = readHashError()
    if (!hashError) return
    if (hashError.code === 'otp_expired' || hashError.code === 'access_denied') {
      setExpiredLink(true)
      setError('El enlace de confirmación no es válido o ha caducado. Introduce tu correo y te enviamos uno nuevo.')
    } else {
      setError('No se pudo completar la confirmación.')
    }
  }, [])

  // Clear the form-level error (and optionally one field's error) as the user
  // edits, so a stale message never lingers next to a field they've just fixed.
  function clearOnEdit(field?: keyof FieldErrors) {
    setError(null)
    if (field) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  // Route a caught auth/RPC error to its field (email/password) or, failing
  // that, to the form-level line. Everything is translated to Spanish here.
  function reportAuthError(err: unknown) {
    const mapped = authErrorMessage(err)
    if (mapped.field) {
      setFieldErrors((prev) => ({ ...prev, [mapped.field as keyof FieldErrors]: mapped.text }))
    } else {
      setError(mapped.text)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})
    setMessage(null)
    setExpiredLink(false)
    const sb = requireSupabase()
    try {
      if (mode === 'signup') {
        const trimmed = username.trim()

        // Validate handle + password before the round trip, and show each
        // message under its own field. The DB is the authority (CHECK + trigger
        // in 0017), but a trigger exception reaches supabase-js as the string
        // "{}", so client-side is the only place we can say what's actually
        // wrong. src/lib/username.ts is the shared source of the handle rule.
        const uErr = usernameError(trimmed)
        const eErr = !email.trim() ? 'Introduce tu correo.' : null
        const pErr = password.length < PASSWORD_MIN ? PASSWORD_HINT : null
        if (uErr || eErr || pErr) {
          setFieldErrors({
            username: uErr ?? undefined,
            email: eErr ?? undefined,
            password: pErr ?? undefined,
          })
          return
        }

        // Check availability BEFORE signing up, not by reading the error after —
        // same reason. A name claimed between here and the insert loses the race
        // and surfaces as the generic failure below; rare, and the retry is right.
        const { data: free, error: checkError } = await sb.rpc('username_available', {
          p_username: trimmed,
        })
        if (checkError) throw checkError
        if (!free) {
          setFieldErrors({ username: 'Ese nombre de usuario ya está en uso. Elige otro.' })
          return
        }

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            // handle_new_user reads this, btrims it, and now REQUIRES it (0017):
            // the username is a public 1v1 handle, unique and format-checked.
            data: { username: trimmed },
            emailRedirectTo: emailRedirectTo(),
          },
        })
        if (error) throw error
        // With email-enumeration protection ON, signing up with an
        // already-registered email is obfuscated as a success carrying a user
        // whose `identities` is empty (no error is thrown). Detect that and say
        // so under the email field, instead of a misleading "check your inbox".
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setFieldErrors({ email: 'Ya existe una cuenta con ese correo.' })
          return
        }
        if (!data.session) {
          setMessage('Cuenta creada. Revisa tu correo para confirmarla.')
        }
      } else {
        // Login by username OR email. An input with '@' is an email and goes
        // straight to Auth. Otherwise it is a username: email_for_login (0017)
        // hands back the account email ONLY when the password already verifies,
        // so the private email is never exposed to an unauthenticated caller.
        const id = loginId.trim()
        let signInEmail = id
        if (!id.includes('@')) {
          const { data: resolved, error: resolveError } = await sb.rpc('email_for_login', {
            p_identifier: id,
            p_password: password,
          })
          if (resolveError) throw resolveError
          if (!resolved) {
            // Deliberately generic: do not reveal whether the username exists.
            setError('Usuario o contraseña incorrectos.')
            return
          }
          signInEmail = resolved as string
        }
        const { error } = await sb.auth.signInWithPassword({ email: signInEmail, password })
        if (error) throw error
      }
    } catch (err) {
      reportAuthError(err)
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    // Sign-in collects "usuario o correo", so fall back to loginId when it is an
    // email; resend has no way to reach an account addressed by username alone.
    const target = (email || loginId).trim()
    if (!target.includes('@')) {
      setError('Introduce tu correo para reenviar la confirmación.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    const sb = requireSupabase()
    try {
      const { error } = await sb.auth.resend({
        type: 'signup',
        email: target,
        options: { emailRedirectTo: emailRedirectTo() },
      })
      if (error) throw error
      setExpiredLink(false)
      setMessage('Te hemos enviado un nuevo correo de confirmación. Ábrelo pronto: el enlace caduca.')
    } catch (err) {
      reportAuthError(err)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-grass-400'

  // Live handle feedback: nothing until they start typing, then the specific
  // rule they're breaking, otherwise the plain hint.
  const usernameLiveError = username.trim() ? usernameError(username) : null

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      {onBack && (
        <button
          onClick={onBack}
          className="self-start text-sm text-slate-400 hover:text-slate-200"
        >
          ‹ Volver
        </button>
      )}
      <div className="text-center">
        <h1 className="font-display text-5xl font-extrabold uppercase text-grass-400">
          Super Gol
        </h1>
        <p className="mt-1 text-slate-400">Colecciona. Ficha. Compite.</p>
      </div>

      <form onSubmit={submit} className="card-surface flex flex-col gap-3 p-5" noValidate>
        {mode === 'signup' ? (
          <>
            <div className="flex flex-col gap-1">
              <input
                required
                autoComplete="username"
                aria-invalid={Boolean(fieldErrors.username ?? usernameLiveError)}
                className={inputClass}
                placeholder="Usuario"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value)
                  clearOnEdit('username')
                }}
              />
              {fieldErrors.username ?? usernameLiveError ? (
                <p className="text-xs text-red-400">{fieldErrors.username ?? usernameLiveError}</p>
              ) : (
                <p className="text-xs text-slate-500">{USERNAME_HINT}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <input
                type="email"
                required
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                className={inputClass}
                placeholder="Correo"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  clearOnEdit('email')
                }}
              />
              {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email}</p>}
            </div>
          </>
        ) : (
          <input
            required
            autoComplete="username"
            className={inputClass}
            placeholder="Usuario o correo"
            value={loginId}
            onChange={(e) => {
              setLoginId(e.target.value)
              clearOnEdit()
            }}
          />
        )}
        <div className="flex flex-col gap-1">
          <input
            type="password"
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-invalid={Boolean(fieldErrors.password)}
            className={inputClass}
            placeholder="Contraseña"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              clearOnEdit('password')
            }}
          />
          {mode === 'signup' &&
            (fieldErrors.password ? (
              <p className="text-xs text-red-400">{fieldErrors.password}</p>
            ) : (
              <p className="text-xs text-slate-500">{PASSWORD_HINT}</p>
            ))}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {message && <p className="text-sm text-grass-400">{message}</p>}

        {expiredLink && (
          <button
            type="button"
            onClick={() => void resendConfirmation()}
            disabled={busy}
            className="text-sm font-semibold text-grass-400 hover:text-grass-300 disabled:opacity-50"
          >
            Reenviar correo de confirmación
          </button>
        )}

        <button type="submit" className="btn-primary mt-1" disabled={busy}>
          {busy ? '…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
        </button>
      </form>

      <button
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setFieldErrors({})
          setMessage(null)
        }}
        className="text-sm text-slate-400 hover:text-slate-200"
      >
        {mode === 'signin'
          ? '¿No tienes cuenta? Crea una'
          : '¿Ya tienes cuenta? Entra'}
      </button>
    </div>
  )
}
