import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { fetchCatalog, fetchPacks, openPack } from '@/data/api'
import { Naipe } from '@/ui/naipe/Naipe'
import { CardSheet } from '@/ui/naipe/CardSheet'
import type { Card, Pack } from '@/lib/types'

export function Store() {
  const { profile, refreshProfile } = useAuth()
  const [packs, setPacks] = useState<Pack[]>([])
  const [catalog, setCatalog] = useState<Record<string, Card>>({})
  const [pulled, setPulled] = useState<Card[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Card | null>(null)

  useEffect(() => {
    Promise.all([fetchPacks(), fetchCatalog()])
      .then(([p, cards]) => {
        setPacks(p)
        setCatalog(Object.fromEntries(cards.map((c) => [c.id, c])))
      })
      .catch((e) => setError(e.message))
  }, [])

  const coins = profile?.coins ?? 0

  async function buy(pack: Pack) {
    setBusy(true)
    setError(null)
    try {
      const result = await openPack(pack.id)
      setPulled(result.cards.map((id) => catalog[id]).filter(Boolean))
      await refreshProfile()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo abrir el sobre')
    } finally {
      setBusy(false)
    }
  }

  const sortedPulled = useMemo(
    () =>
      pulled
        ? [...pulled].sort((a, b) => b.cost - a.cost)
        : null,
    [pulled],
  )

  if (sortedPulled) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-bold">¡Sobre abierto!</h1>
        <div className="grid grid-cols-2 gap-3">
          {sortedPulled.map((c, i) => (
            <Naipe key={`${c.id}-${i}`} card={c} onClick={() => setOpen(c)} />
          ))}
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setPulled(null)
            // Leaving the reveal must drop the inspected card too, or the next
            // pack opens straight into a sheet showing the previous one.
            setOpen(null)
          }}
        >
          Volver a la tienda
        </button>
        <CardSheet card={open} onClose={() => setOpen(null)} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-bold">Tienda</h1>
      {error && <p className="text-sm text-red-400">{error}</p>}

      {packs.map((pack) => {
        const affordable = coins >= pack.price
        return (
          <div key={pack.id} className="card-surface p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display text-xl font-bold">{pack.name}</div>
                <div className="mt-0.5 text-sm text-slate-400">
                  {pack.description}
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-black/40 px-3 py-1 text-sm font-bold text-rare">
                {pack.price} 🪙
              </span>
            </div>
            <button
              className="btn-primary mt-4 w-full"
              disabled={busy || !affordable}
              onClick={() => buy(pack)}
            >
              {affordable ? 'Abrir sobre' : 'Monedas insuficientes'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
