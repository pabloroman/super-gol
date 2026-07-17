import { useCallback, useEffect, useState } from 'react'
import { fetchCollection } from '@/data/api'
import { Naipe } from '@/ui/naipe/Naipe'
import { CardSheet } from '@/ui/naipe/CardSheet'
import { CardFilters } from '@/ui/CardFilters'
import { useCardFilters } from '@/ui/useCardFilters'
import type { Card, CollectionEntry } from '@/lib/types'

const getCard = (e: CollectionEntry) => e.card

export function Collection() {
  const [entries, setEntries] = useState<CollectionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Card | null>(null)

  useEffect(() => {
    fetchCollection()
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const { filtered, state } = useCardFilters(entries, getCard)
  const totalCards = entries.reduce((n, e) => n + e.quantity, 0)
  const show = useCallback((card: Card) => setOpen(card), [])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Colección</h1>
        <span className="shrink-0 text-sm tabular-nums text-slate-400">
          {entries.length} distintas · {totalCards} cartas
        </span>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading && <p className="text-slate-500">Cargando…</p>}

      {!loading && entries.length > 0 && (
        // The filters stack above the grid below lg and become a sticky rail at
        // lg. CardFilters is already a vertical stack, so this is pure placement
        // — the component is untouched and the Equipo picker keeps using it as
        // is. The rail waits for lg rather than md deliberately: at md a 15rem
        // rail would leave room for only 3 columns of 144px cards, i.e. *smaller*
        // than the phone's 202px. Shrinking the cards on a bigger screen to make
        // room for controls used occasionally is a bad trade.
        //
        // The whole block sits inside this guard on purpose: a conditional
        // <aside> inside a live 2-col grid would drop the card grid into the
        // 15rem track.
        <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside className="mb-4 lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:mb-0">
            <CardFilters state={state} count={filtered.length} />
          </aside>

          <div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {filtered.map((e) => (
                <Naipe
                  key={e.card.id}
                  card={e.card}
                  quantity={e.quantity}
                  onClick={() => show(e.card)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <p className="text-slate-500">
                Ninguna carta coincide con esos filtros.
              </p>
            )}
          </div>
        </div>
      )}

      {!loading && entries.length === 0 && (
        <p className="text-slate-500">
          Tu colección está vacía. Abre un sobre en la tienda.
        </p>
      )}

      <CardSheet card={open} onClose={() => setOpen(null)} />
    </div>
  )
}
