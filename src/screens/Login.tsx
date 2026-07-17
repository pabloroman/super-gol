import { useEffect, useState, type FormEvent } from 'react'
import { requireSupabase } from '@/lib/supabase'

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

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expiredLink, setExpiredLink] = useState(false)

  useEffect(() => {
    const hashError = readHashError()
    if (!hashError) return
    if (hashError.code === 'otp_expired' || hashError.code === 'access_denied') {
      setExpiredLink(true)
      setError('El enlace de confirmación no es válido o ha caducado. Introduce tu correo y te enviamos uno nuevo.')
    } else {
      setError(hashError.description ?? 'No se pudo completar la confirmación.')
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    setExpiredLink(false)
    const sb = requireSupabase()
    try {
      if (mode === 'signup') {
        const trimmed = username.trim()

        // Check the name BEFORE signing up, not by reading the error after.
        // handle_new_user still refuses a duplicate (0012), but supabase-js turns
        // the resulting 500 into an AuthRetryableFetchError and throws the body
        // away — whatever the trigger raises reaches us as the string "{}". So
        // this is the only point at which we can say something true to the user.
        // A name claimed between here and the insert loses the race and surfaces
        // as the generic failure below; rare, and the retry is correct.
        if (trimmed) {
          const { data: free, error: checkError } = await sb.rpc('username_available', {
            p_username: trimmed,
          })
          if (checkError) throw checkError
          if (!free) {
            setError('Ese nombre de entrenador ya está en uso. Elige otro.')
            return
          }
        }

        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: {
            // Send it blank if it is blank: handle_new_user turns blank into a
            // NULL username. Defaulting to 'Entrenador' here is what broke
            // signup — profiles.username is unique, so the first blank signup
            // reserved that name and every later one collided. Home and the
            // admin list already render 'Entrenador' for a null, so the fallback
            // lives there, where it is a label and not a claim.
            data: { username: trimmed },
            emailRedirectTo: emailRedirectTo(),
          },
        })
        if (error) throw error
        if (!data.session) {
          setMessage('Cuenta creada. Revisa tu correo para confirmarla.')
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Algo ha fallado')
    } finally {
      setBusy(false)
    }
  }

  async function resendConfirmation() {
    if (!email) {
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
        email,
        options: { emailRedirectTo: emailRedirectTo() },
      })
      if (error) throw error
      setExpiredLink(false)
      setMessage('Te hemos enviado un nuevo correo de confirmación. Ábrelo pronto: el enlace caduca.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reenviar el correo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl font-extrabold uppercase text-grass-400">
          Super Gol
        </h1>
        <p className="mt-1 text-slate-400">Colecciona. Ficha. Compite.</p>
      </div>

      <form onSubmit={submit} className="card-surface flex flex-col gap-3 p-5">
        {mode === 'signup' && (
          <input
            className="rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-grass-400"
            placeholder="Nombre de entrenador"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}
        <input
          type="email"
          required
          autoComplete="email"
          className="rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-grass-400"
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          required
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-grass-400"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

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
