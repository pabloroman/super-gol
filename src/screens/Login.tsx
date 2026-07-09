import { useState, type FormEvent } from 'react'
import { requireSupabase } from '@/lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    const sb = requireSupabase()
    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { username: username || 'Entrenador' } },
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
