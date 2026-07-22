import { useEffect, useMemo, useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '@/auth/AuthProvider'
import { adminListWaitlist, adminSendInvites, adminSetWaitlist } from '@/data/api'
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
    'correo,fecha_alta,invitado',
    ...entries.map((e) => `${esc(e.email)},${esc(e.created_at)},${esc(e.invited_at ?? '')}`),
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
function WaitlistRow({
  entry,
  selected,
  onToggle,
}: {
  entry: WaitlistEntry
  selected: boolean
  onToggle: (id: string) => void
}) {
  const invited = Boolean(entry.invited_at)
  return (
    <tr className="flex items-center gap-3 border-b border-white/5 py-2 md:table-row md:border-0 md:py-0 md:[&>td]:border-b md:[&>td]:border-white/5 md:[&>td]:px-2 md:[&>td]:py-1.5">
      <td className="block shrink-0 md:table-cell">
        {invited ? (
          <CheckCircleIcon className="h-4 w-4 text-grass-400" aria-label="Invitado" />
        ) : (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(entry.id)}
            aria-label={`Seleccionar ${entry.email}`}
          />
        )}
      </td>
      <td className="block min-w-0 flex-1 truncate text-sm text-slate-200 md:table-cell">
        {entry.email}
      </td>
      <td className="hidden shrink-0 text-xs text-slate-500 md:table-cell">
        {fmtDate(entry.created_at)}
      </td>
      <td className="block shrink-0 text-right text-xs md:table-cell md:text-left">
        {invited ? (
          <span className="text-grass-400">Invitado · {fmtDate(entry.invited_at!)}</span>
        ) : (
          <span className="text-slate-500">Pendiente</span>
        )}
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
  // Selected PENDING ids (invited rows are never selectable). Cleared after a send
  // and whenever the list re-pulls.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [inviting, setInviting] = useState(false)
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null)

  const pendingIds = useMemo(
    () => entries.filter((e) => !e.invited_at).map((e) => e.id),
    [entries],
  )
  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selected.has(id))

  async function reload() {
    const fresh = await adminListWaitlist()
    setEntries(fresh)
    setSelected(new Set())
  }

  useEffect(() => {
    setLoading(true)
    reload()
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

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllPending() {
    setSelected(allPendingSelected ? new Set() : new Set(pendingIds))
  }

  async function sendInvites() {
    const ids = [...selected]
    if (ids.length === 0) return
    setInviting(true)
    setError(null)
    setResult(null)
    try {
      const res = await adminSendInvites(ids)
      setResult(res)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setInviting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The switch. Turning it on closes new registration everywhere; the landing
          page shows the waitlist form instead, and the server refuses signups —
          except for individually invited emails (0022). */}
      <div className="card-surface flex items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-bold">Modo lista de espera</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cuando está activo, la portada muestra el formulario de lista de espera
            y se bloquea el registro de nuevas cuentas, salvo las personas que
            invites desde aquí. Iniciar sesión sigue disponible.
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-slate-500">
          {entries.length} {entries.length === 1 ? 'inscrito' : 'inscritos'}
          {pendingIds.length > 0 && ` · ${pendingIds.length} pendientes`}
        </span>
        <div className="flex items-center gap-2">
          {pendingIds.length > 0 && (
            <button
              type="button"
              onClick={toggleAllPending}
              className="shrink-0 rounded bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 transition md:hover:bg-white/10"
            >
              {allPendingSelected ? 'Quitar selección' : 'Seleccionar pendientes'}
            </button>
          )}
          <button
            type="button"
            onClick={() => void sendInvites()}
            disabled={selected.size === 0 || inviting}
            className="shrink-0 rounded bg-grass-500/20 px-3 py-1.5 text-sm font-semibold text-grass-300 transition md:hover:bg-grass-500/30 disabled:opacity-50"
          >
            {inviting ? 'Invitando…' : `Invitar seleccionados (${selected.size})`}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(entries)}
            disabled={entries.length === 0}
            className="shrink-0 rounded bg-white/5 px-3 py-1.5 text-sm font-semibold text-slate-100 transition md:hover:bg-white/10 disabled:opacity-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {result && (
        <p className="text-sm text-grass-400">
          Invitados {result.sent}
          {result.failed > 0 && ` · ${result.failed} fallidos`}
        </p>
      )}
      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <table className="block w-full md:table md:border-separate md:border-spacing-0">
        <thead className="hidden md:table-header-group">
          <tr className="text-left font-display text-xs uppercase tracking-widest text-slate-500 [&>th]:sticky [&>th]:top-topbar [&>th]:z-10 [&>th]:border-b [&>th]:border-white/10 [&>th]:bg-pitch-900 [&>th]:px-2 [&>th]:py-2">
            <th aria-label="Seleccionar" />
            <th>Correo</th>
            <th>Alta</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {entries.map((e) => (
            <WaitlistRow
              key={e.id}
              entry={e}
              selected={selected.has(e.id)}
              onToggle={toggleOne}
            />
          ))}
        </tbody>
      </table>
      {!loading && entries.length === 0 && (
        <p className="text-slate-500">Aún no hay inscritos.</p>
      )}
    </div>
  )
}
