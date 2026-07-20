import { useState } from 'react'
import { joinWaitlist } from '@/data/api'

// Same lenient shape the server validates (join_waitlist / the waitlist CHECK,
// 0021). The DB is the authority; this only lets us show a Spanish message
// before the round trip.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * The pre-launch call to action: capture an email onto the waitlist. Shown by
 * Landing in place of the "Empezar a jugar" signup button while waitlist mode is
 * on (App reads the flag from AuthProvider). The RPC is idempotent, so a repeat
 * email lands on the same "you're on the list" confirmation.
 */
export function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_RE.test(trimmed)) {
      setError('Introduce un correo válido.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await joinWaitlist(trimmed)
      setDone(true)
    } catch {
      // join_waitlist rarely fails once the format check passes; keep it generic
      // and Spanish, matching the app's auth-error posture.
      setError('No se pudo completar. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-grass-500/10 p-5 text-center ring-1 ring-grass-500/30">
        <p className="font-display text-lg font-bold uppercase tracking-wide text-grass-400">
          ¡Estás en la lista!
        </p>
        <p className="mt-1 text-sm text-slate-300">
          Te avisaremos en cuanto abramos el juego.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" noValidate>
      <div className="flex flex-col gap-2 md:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(error)}
          aria-label="Correo"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (error) setError(null)
          }}
          className="flex-1 rounded-xl bg-black/30 px-4 py-3 text-center outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-grass-400 md:text-left"
        />
        <button type="submit" className="btn-primary md:px-8" disabled={busy}>
          {busy ? '…' : 'Únete a la lista'}
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  )
}
