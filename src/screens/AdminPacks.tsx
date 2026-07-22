import { useEffect, useState } from 'react'
import { adminSetPackPrice, fetchPacks } from '@/data/api'
import { Coin } from '@/ui/Coin'
import type { Pack } from '@/lib/types'

// ---------- per-pack price editor ----------
// One editable field (price), so no Sheet modal like AdminUsers — the row edits
// inline. Each row owns its price/busy/error state; the save handler mirrors
// AdminUsers' applyCoins (busy → RPC → optimistic parent update → confirmation).
function PackRow({ pack, onUpdated }: { pack: Pack; onUpdated: (next: Pack) => void }) {
  const [price, setPrice] = useState(String(pack.price))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // A bare "" mid-typing parses to NaN → "not a valid price yet", not zero.
  const parsed = price.trim() === '' ? NaN : Number(price)
  const valid = Number.isInteger(parsed) && parsed >= 0
  const changed = valid && parsed !== pack.price

  async function save() {
    if (!changed) return
    setBusy(true)
    setError(null)
    setDone(false)
    try {
      await adminSetPackPrice(pack.id, parsed)
      onUpdated({ ...pack, price: parsed })
      setDone(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl bg-black/20 p-4 ring-1 ring-white/10">
      <div className="min-w-0">
        <h3 className="font-display font-bold">{pack.name}</h3>
        {pack.description && (
          <p className="mt-0.5 text-xs text-slate-500">{pack.description}</p>
        )}
        <p className="mt-1 font-mono text-xs text-slate-600">
          {pack.card_count} cartas · {pack.id}
        </p>
      </div>

      <div className="mt-3 flex items-end gap-2">
        <label className="text-xs text-slate-400">
          <span className="flex items-center gap-1">
            Precio <Coin />
          </span>
          <input
            className="mt-1 w-32 rounded bg-black/30 px-2 py-1 text-sm tabular-nums ring-1 ring-white/10 outline-none focus:ring-grass-400"
            type="number"
            step={1}
            min={0}
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              setDone(false)
              setError(null)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !changed}
          className="shrink-0 rounded bg-grass-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-grass-400 disabled:opacity-50"
        >
          Guardar
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {done && <p className="mt-2 text-sm text-grass-400">Precio actualizado.</p>}
    </div>
  )
}

// ---------- tab ----------
export function AdminPacks() {
  const [packs, setPacks] = useState<Pack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchPacks()
      .then(setPacks)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  function onUpdated(next: Pack) {
    setPacks((prev) => prev.map((p) => (p.id === next.id ? next : p)))
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-400">
        Ajusta el precio de cada sobre. El cambio se aplica de inmediato en la Tienda.
      </p>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-col gap-3">
        {packs.map((p) => (
          <PackRow key={p.id} pack={p} onUpdated={onUpdated} />
        ))}
      </div>
      {!loading && !error && packs.length === 0 && (
        <p className="text-slate-500">No hay sobres.</p>
      )}
    </div>
  )
}
