import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { requireSupabase } from '@/lib/supabase'
import { authErrorMessage } from '@/lib/authErrors'
import { readHashError } from '@/lib/authHash'

// Mirror Login's password floor: a short password fails with a Spanish hint
// before the round trip instead of returning GoTrue's English `weak_password`.
const PASSWORD_MIN = 6
const PASSWORD_HINT = `Mínimo ${PASSWORD_MIN} caracteres.`

/**
 * The password-recovery callback. App.tsx renders this whenever the path is
 * `/reset-password` — ahead of the session gate — so it is reachable both when
 * the recovery session took (the happy path) and when the link was invalid or
 * expired (no session, only an error hash). It calls `updateUser({ password })`
 * on the recovery session and then drops the user straight into the app.
 *
 * Styling and the per-field error pattern mirror Login so the two forms match.
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  // Form-level error (always Spanish — see authErrorMessage).
  const [error, setError] = useState<string | null>(null)
  // Validation/error shown under the password inputs.
  const [fieldError, setFieldError] = useState<string | null>(null)
  // Set when the recovery link itself was invalid/expired: Supabase redirects
  // here with an error hash and never establishes a session, so we hide the form
  // (it could never submit) and offer a way back to request a fresh link.
  const [linkInvalid, setLinkInvalid] = useState(false)

  useEffect(() => {
    if (readHashError()) setLinkInvalid(true)
  }, [])

  function clearErrors() {
    setError(null)
    setFieldError(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    clearErrors()
    if (password.length < PASSWORD_MIN) {
      setFieldError(PASSWORD_HINT)
      return
    }
    if (password !== confirm) {
      setFieldError('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    const sb = requireSupabase()
    try {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw error
      // The recovery link already established a session, so saving the new
      // password leaves us authenticated — go straight to the app. `replace`
      // drops /reset-password from history so Back doesn't return to it.
      navigate('/', { replace: true })
    } catch (err) {
      const mapped = authErrorMessage(err)
      if (mapped.field === 'password') setFieldError(mapped.text)
      else setError(mapped.text)
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'rounded-xl bg-black/30 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-grass-400'

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <h1 className="font-display text-5xl font-extrabold uppercase text-grass-400">
          Super Gol
        </h1>
        <p className="mt-1 text-slate-400">Restablece tu contraseña</p>
      </div>

      {linkInvalid ? (
        <div className="card-surface flex flex-col gap-3 p-5">
          <p className="text-sm text-red-400">
            El enlace ha caducado o no es válido. Vuelve a solicitar uno nuevo para
            restablecer tu contraseña.
          </p>
          <button
            type="button"
            onClick={() => navigate('/', { replace: true })}
            className="btn-primary mt-1"
          >
            Volver al inicio
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="card-surface flex flex-col gap-3 p-5" noValidate>
          <div className="flex flex-col gap-1">
            <input
              type="password"
              required
              autoComplete="new-password"
              aria-invalid={Boolean(fieldError)}
              className={inputClass}
              placeholder="Nueva contraseña"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                clearErrors()
              }}
            />
            {fieldError ? (
              <p className="text-xs text-red-400">{fieldError}</p>
            ) : (
              <p className="text-xs text-slate-500">{PASSWORD_HINT}</p>
            )}
          </div>
          <input
            type="password"
            required
            autoComplete="new-password"
            className={inputClass}
            placeholder="Confirmar contraseña"
            value={confirm}
            onChange={(e) => {
              setConfirm(e.target.value)
              clearErrors()
            }}
          />

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button type="submit" className="btn-primary mt-1" disabled={busy}>
            {busy ? '…' : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </div>
  )
}
