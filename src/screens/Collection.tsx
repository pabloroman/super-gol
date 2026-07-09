import { useEffect, useState } from 'react'
import { fetchCollection } from '@/data/api'
import { CardTile } from '@/ui/CardTile'
import type { CollectionEntry } from '@/lib/types'

export function Collection() {
  const [entries, setEntries] = useState<CollectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCollection()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalCards = entries.reduce((n, e) => n + e.quantity, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold">Colección</h1>
        <span className="text-sm text-slate-400">
          {entries.length} distintas · {totalCards} cartas
        </span>
      </div>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        {entries.map((e) => (
          <CardTile key={e.card.id} card={e.card} quantity={e.quantity} />
        ))}
      </div>

      {!loading && entries.length === 0 && (
        <p className="text-slate-500">
          Tu colección está vacía. Abre un sobre en la tienda.
        </p>
      )}
    </div>
  )
}
