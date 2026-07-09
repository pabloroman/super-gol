import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { fetchActiveSquad, fetchCollection, saveSquad } from '@/data/api'
import { CardTile } from '@/ui/CardTile'
import {
  POINT_CAP,
  STARTER_COUNT,
  MAX_BENCH,
  validateSquad,
} from '@/game/squad'
import type { Card } from '@/lib/types'

type Role = 'starter' | 'bench'

export function SquadBuilder() {
  const { refreshProfile } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [name, setName] = useState('Mi equipo')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchCollection(), fetchActiveSquad()])
      .then(([collection, squad]) => {
        setCards(collection.map((e) => e.card))
        if (squad) {
          setName(squad.name)
          const initial: Record<string, Role> = {}
          for (const slot of squad.slots) {
            initial[slot.card_id] = slot.is_starter ? 'starter' : 'bench'
          }
          setRoles(initial)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const byId = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c])),
    [cards],
  )

  const starterIds = Object.keys(roles).filter((id) => roles[id] === 'starter')
  const benchIds = Object.keys(roles).filter((id) => roles[id] === 'bench')
  const starterCards = starterIds.map((id) => byId[id]).filter(Boolean)
  const benchCards = benchIds.map((id) => byId[id]).filter(Boolean)

  const validation = validateSquad(starterCards, benchCards)

  function cycle(id: string) {
    setMessage(null)
    setRoles((prev) => {
      const next = { ...prev }
      const cur = next[id]
      const starters = Object.values(next).filter((r) => r === 'starter').length
      const bench = Object.values(next).filter((r) => r === 'bench').length
      if (!cur) {
        if (starters < STARTER_COUNT) next[id] = 'starter'
        else if (bench < MAX_BENCH) next[id] = 'bench'
      } else if (cur === 'starter') {
        if (bench < MAX_BENCH) next[id] = 'bench'
        else delete next[id]
      } else {
        delete next[id]
      }
      return next
    })
  }

  async function save() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await saveSquad(name, '4-4-2', starterIds, benchIds)
      await refreshProfile()
      setMessage('Equipo guardado ✓')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const overCap = validation.cost > POINT_CAP

  return (
    <div className="flex flex-col gap-4 pb-4">
      <input
        className="rounded-xl bg-black/30 px-4 py-2 font-display text-xl font-bold outline-none ring-1 ring-white/10 focus:ring-grass-400"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      {/* Sticky status bar */}
      <div className="card-surface sticky top-16 z-10 flex items-center justify-between p-4">
        <div className="text-sm">
          <div>
            <span className="text-slate-400">Titulares </span>
            <span className="font-bold">{starterIds.length}/11</span>
            <span className="text-slate-400"> · Banquillo </span>
            <span className="font-bold">{benchIds.length}/5</span>
          </div>
          <div className={overCap ? 'text-red-400' : 'text-slate-400'}>
            Coste{' '}
            <span className="font-bold">
              {validation.cost}/{POINT_CAP}
            </span>{' '}
            pts
          </div>
        </div>
        <button
          className="btn-primary"
          disabled={busy || !validation.ok}
          onClick={save}
        >
          Guardar
        </button>
      </div>

      {message && <p className="text-sm text-grass-400">{message}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!validation.ok && validation.errors.length > 0 && (
        <ul className="space-y-0.5 text-xs text-slate-500">
          {validation.errors.map((err, i) => (
            <li key={i}>• {err}</li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500">
        Toca una carta: 1ª vez titular, 2ª suplente, 3ª la quitas.
      </p>

      {loading && <p className="text-slate-500">Cargando…</p>}

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const role = roles[card.id]
          return (
            <div key={card.id} className="relative">
              {role && (
                <span
                  className={`absolute -right-1 -top-1 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    role === 'starter'
                      ? 'bg-grass-500 text-white'
                      : 'bg-frequent text-pitch-900'
                  }`}
                >
                  {role === 'starter' ? 'TITULAR' : 'SUPLENTE'}
                </span>
              )}
              <CardTile
                card={card}
                selected={Boolean(role)}
                onClick={() => cycle(card.id)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
