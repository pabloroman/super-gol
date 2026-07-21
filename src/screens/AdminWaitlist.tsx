import { useEffect, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { adminListWaitlist, adminSetWaitlist } from '@/data/api'
import type { WaitlistEntry } from '@/lib/types'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Build a CSV of the waitlist and hand it to the browser as a download. Small and
 * self-contained — the app's other CSV path (src/cards/csv.ts) is card-shaped, so
 * there's nothing to reuse here. Fields are quoted and internal quotes doubled,
 * the standard RFC-4180 escape, in case an email ever carries a comma.
 */
function downloadCsv(entries: WaitlistEntry[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const rows = [
    'correo,fecha_alta',
    ...entries.map((e) => `${esc(e.email)},${esc(e.created_at)}`),
  ]
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lista-espera-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- one row, both widths (the AdminUsers/CardRow shape) ----------
function WaitlistRow({ entry }: { entry: WaitlistEntry }) {
  return (
    <tr className="flex items-center gap-3 border-b border-white/5 py-2 md:table-row md:border-0 md:py-0 md:[&>td]:border-b md:[&>td]:border-white/5 md:[&>td]:px-2 md:[&>td]:py-1.5">
      <td className="block min-w-0 flex-1 truncate text-sm text-slate-200 md:table-cell">
        {entry.email}
      </td>
      <td className="block shrink-0 text-right text-xs text-slate-500 md:table-cell md:text-left">
        {fmtDate(entry.created_at)}
      </td>
    </tr>
  )
}

// ---------- tab ----------
export function AdminWaitlist() {
  const { waitlistEnabled, refreshSettings } = useAuth()
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    setLoading(true)
    adminListWaitlist()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  async function toggle(next: boolean) {
    setToggling(true)
    setError(null)
    try {
      await adminSetWaitlist(next)
      // Re-pull so the context flag (and the landing gate that reads it) reflect
      // the change immediately, not just this checkbox.
      await refreshSettings()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The switch. Turning it on closes new registration everywhere; the landing
          page shows the waitlist form instead, and the server refuses signups. */}
      <div className="card-surface flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold">Modo lista de espera</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cuando está activo, la portada muestra el formulario de lista de espera
            y se bloquea el registro de nuevas cuentas. Iniciar sesión sigue
            disponible.
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={waitlistEnabled}
            disabled={toggling}
            onChange={(e) => void toggle(e.target.checked)}
          />
          <span className={waitlistEnabled ? 'text-grass-400' : 'text-slate-400'}>
            {waitlistEnabled ? 'Activo' : 'Inactivo'}
          </span>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-slate-500">
          {entries.length} {entries.length === 1 ? 'inscrito' : 'inscritos'}
        </span>
        <button
          type="button"
          onClick={() => downloadCsv(entries)}
          disabled={entries.length === 0}
          className="shrink-0 rounded bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 transition md:hover:bg-white/10 disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <table className="block w-full md:table md:border-separate md:border-spacing-0">
        <thead className="hidden md:table-header-group">
          <tr className="text-left font-display text-xs uppercase tracking-widest text-slate-500 [&>th]:sticky [&>th]:top-topbar [&>th]:z-10 [&>th]:border-b [&>th]:border-white/10 [&>th]:bg-pitch-900 [&>th]:px-2 [&>th]:py-2">
            <th>Correo</th>
            <th>Alta</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {entries.map((e) => (
            <WaitlistRow key={e.id} entry={e} />
          ))}
        </tbody>
      </table>
      {!loading && entries.length === 0 && (
        <p className="text-slate-500">Aún no hay inscritos.</p>
      )}
    </div>
  )
}
