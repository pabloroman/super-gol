import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { adminAdjustCoins, adminListUsers, adminSetAdmin } from '@/data/api'
import { Sheet } from '@/ui/Sheet'
import type { AdminUser } from '@/lib/types'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** username is nullable, so the list needs a fallback label — and it is only a
 *  label: the email is what identifies a row (hence the Correo column). */
function displayName(u: AdminUser): string {
  return u.username?.trim() || 'Entrenador'
}

// ---------- per-user editor (modal) ----------
function UserEditor({
  initial,
  isSelf,
  onClose,
  onUpdated,
}: {
  initial: AdminUser
  isSelf: boolean
  onClose: () => void
  onUpdated: (user: AdminUser) => void
}) {
  const [user, setUser] = useState<AdminUser>(initial)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  // Signed: a bare "-" or "+" mid-typing parses to NaN, which must read as "not a
  // valid amount yet" rather than as zero.
  const delta = amount.trim() === '' ? NaN : Number(amount)
  const validDelta = Number.isInteger(delta) && delta !== 0
  const nextBalance = validDelta ? user.coins + delta : user.coins

  async function applyCoins() {
    if (!validDelta) return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const coins = await adminAdjustCoins(user.id, delta, reason)
      const next = { ...user, coins }
      setUser(next)
      onUpdated(next)
      setAmount('')
      setReason('')
      setDone(`Saldo actualizado: ${coins} 🪙`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleAdmin(next: boolean) {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await adminSetAdmin(user.id, next)
      const updated = { ...user, is_admin: next }
      setUser(updated)
      onUpdated(updated)
      setDone(next ? 'Ahora es admin.' : 'Ya no es admin.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded bg-black/30 px-2 py-1 text-sm ring-1 ring-white/10'

  return (
    <Sheet open onClose={onClose} title={displayName(user)}>
      <div className="min-h-0 overflow-y-auto">
        {/* Identity is read-only: username and email are the user's own, and
            changing an email is an auth-side flow (re-confirmation), not a
            profiles UPDATE. */}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">Correo</dt>
            <dd className="truncate text-slate-200">{user.email ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-slate-500">id</dt>
            <dd className="truncate font-mono text-xs text-slate-400">{user.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Alta</dt>
            <dd className="text-slate-200">{fmtDate(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Cartas · Partidos</dt>
            <dd className="tabular-nums text-slate-200">
              {user.cards_owned} · {user.matches_played}
            </dd>
          </div>
        </dl>

        <hr className="my-4 border-white/10" />

        <div>
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-sm font-bold">Saldo</h3>
            <span className="text-sm font-bold tabular-nums text-rare">{user.coins} 🪙</span>
          </div>
          {/* Signed amount, matching transactions.amount (+ingreso / -gasto)
              rather than a separate add/remove mode — the ledger this writes to
              is signed, so the input reads the same as the row it produces. */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <label className="text-xs text-slate-400">
              Cantidad (+/−)
              <input
                className={field}
                type="number"
                step={1}
                placeholder="+100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="col-span-2 text-xs text-slate-400">
              Motivo (opcional)
              <input
                className={field}
                value={reason}
                placeholder="compensación, prueba…"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {validDelta ? (
                <>
                  Nuevo saldo:{' '}
                  <span className={nextBalance < 0 ? 'text-red-400' : 'text-slate-300'}>
                    {nextBalance} 🪙
                  </span>
                </>
              ) : (
                'Se registra en el libro de transacciones.'
              )}
            </span>
            <button
              type="button"
              onClick={() => void applyCoins()}
              disabled={busy || !validDelta || nextBalance < 0}
              className="shrink-0 rounded bg-grass-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-grass-400 disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        </div>

        <hr className="my-4 border-white/10" />

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-sm font-bold">Admin</h3>
            <p className="text-xs text-slate-500">
              {isSelf
                ? 'No puedes quitarte el admin a ti mismo.'
                : 'Acceso al catálogo y a la gestión de usuarios.'}
            </p>
          </div>
          {/* Disabled on self: the RPC refuses a self-revoke (the flag is settable
              only from the DB or by another admin, so the last admin demoting
              themselves would lock it out of the app for good). Disabling here
              just says so before the round trip. */}
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={user.is_admin}
              disabled={busy || isSelf}
              onChange={(e) => void toggleAdmin(e.target.checked)}
            />
            <span className={user.is_admin ? 'text-grass-400' : 'text-slate-400'}>
              {user.is_admin ? 'Sí' : 'No'}
            </span>
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        {done && <p className="mt-3 text-sm text-grass-400">{done}</p>}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Sheet>
  )
}

// ---------- user row ----------
/** One render for both widths — a real <tr> above md, flex/block below, the same
 *  shape the catalog's CardRow uses. */
function UserRow({ user, isSelf, onEdit }: { user: AdminUser; isSelf: boolean; onEdit: () => void }) {
  return (
    <tr
      onClick={onEdit}
      className="flex cursor-pointer items-center gap-3 border-b border-white/5 py-2 transition md:table-row md:border-0 md:py-0 md:hover:bg-white/5 md:[&>td]:border-b md:[&>td]:border-white/5 md:[&>td]:px-2 md:[&>td]:py-1.5"
    >
      <td className="block min-w-0 flex-1 md:table-cell">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="block max-w-full truncate text-left text-sm font-semibold transition md:hover:text-grass-400"
        >
          {displayName(user)}
          {isSelf && <span className="ml-1 text-xs font-normal text-slate-500">(tú)</span>}
        </button>
        <span className="block truncate text-xs text-slate-500 md:hidden">
          {user.email ?? '—'}
        </span>
      </td>
      <td className="hidden min-w-0 text-sm text-slate-300 md:table-cell">
        <span className="block max-w-[22ch] truncate lg:max-w-none">{user.email ?? '—'}</span>
      </td>
      <td className="block shrink-0 text-right text-sm font-bold tabular-nums text-rare md:table-cell">
        {user.coins}
      </td>
      <td className="hidden text-right text-sm tabular-nums text-slate-400 lg:table-cell">
        {user.cards_owned}
      </td>
      <td className="hidden text-right text-sm tabular-nums text-slate-400 lg:table-cell">
        {user.matches_played}
      </td>
      <td className="block shrink-0 text-center text-xs md:table-cell">
        {user.is_admin ? <span className="text-grass-400">✓</span> : <span className="text-slate-600">—</span>}
      </td>
      <td className="hidden text-xs text-slate-500 xl:table-cell">{fmtDate(user.created_at)}</td>
    </tr>
  )
}

// ---------- tab ----------
export function AdminUsers() {
  const { profile, refreshProfile } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<AdminUser | null>(null)

  useEffect(() => {
    setLoading(true)
    adminListUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // No useCardFilters here: that hook filters by rarity/position/ficha, which a
  // user has none of. A name/email substring is the whole of what this needs.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        displayName(u).toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    )
  }, [users, query])

  function onUpdated(next: AdminUser) {
    setUsers((prev) => prev.map((u) => (u.id === next.id ? next : u)))
    // The TopBar reads coins and the admin gear from the auth profile, so editing
    // your own row has to re-pull it or the chrome keeps the stale numbers.
    if (next.id === profile?.id) void refreshProfile()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar por nombre o correo"
          className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-grass-400 md:max-w-sm"
        />
        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {filtered.length} {filtered.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </div>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <table className="block w-full md:table md:border-separate md:border-spacing-0">
        <thead className="hidden md:table-header-group">
          <tr className="text-left font-display text-xs uppercase tracking-widest text-slate-500 [&>th]:sticky [&>th]:top-topbar [&>th]:z-10 [&>th]:border-b [&>th]:border-white/10 [&>th]:bg-pitch-900 [&>th]:px-2 [&>th]:py-2">
            <th>Entrenador</th>
            <th>Correo</th>
            <th className="text-right">Monedas</th>
            <th className="hidden text-right lg:table-cell">Cartas</th>
            <th className="hidden text-right lg:table-cell">Partidos</th>
            <th className="text-center">Admin</th>
            <th className="hidden xl:table-cell">Alta</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              isSelf={u.id === profile?.id}
              onEdit={() => setEditing(u)}
            />
          ))}
        </tbody>
      </table>
      {!loading && filtered.length === 0 && <p className="text-slate-500">Sin resultados.</p>}

      {editing && (
        <UserEditor
          initial={editing}
          isSelf={editing.id === profile?.id}
          onClose={() => setEditing(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  )
}
