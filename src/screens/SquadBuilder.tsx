import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { fetchActiveSquad, fetchCollection, saveSquad } from '@/data/api'
import { Naipe } from '@/ui/naipe/Naipe'
import { Sheet } from '@/ui/Sheet'
import { CardFilters } from '@/ui/CardFilters'
import { useCardFilters } from '@/ui/useCardFilters'
import { positionAbbr, positionRank } from '@/ui/positions'
import {
  POINT_CAP,
  STARTER_COUNT,
  MAX_BENCH,
  validateSquad,
} from '@/game/squad'
import type { Card } from '@/lib/types'

type Role = 'starter' | 'bench'

const getCard = (c: Card) => c

/** Keeper first, then out towards the opposition goal; ficha descending within a line. */
function bySquadOrder(a: Card, b: Card) {
  return (
    positionRank(a.position) - positionRank(b.position) ||
    b.cost - a.cost ||
    a.name.localeCompare(b.name, 'es')
  )
}

function SquadCard({
  card,
  role,
  onRemove,
}: {
  card: Card
  role: Role
  onRemove: () => void
}) {
  const pos = positionAbbr(card.position)
  return (
    <div className="relative">
      <Naipe card={card} selected={role === 'starter'} />
      <div className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1">
        {pos && (
          <span className="rounded-full bg-black/85 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-slate-300">
            {pos}
          </span>
        )}
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${
            role === 'starter' ? 'bg-grass-500 text-white' : 'bg-frequent text-pitch-900'
          }`}
        >
          {role === 'starter' ? 'TITULAR' : 'SUPLENTE'}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar a ${card.name} del equipo`}
        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/85 text-xs text-slate-300 ring-1 ring-white/20 transition hover:bg-red-500 hover:text-white"
      >
        ✕
      </button>
    </div>
  )
}

function AddSlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="aspect-naipe flex w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/20 text-grass-400 transition hover:border-grass-400 hover:bg-white/5"
    >
      <span className="text-xl leading-none" aria-hidden>
        ＋
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  )
}

export function SquadBuilder() {
  const { refreshProfile } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [roles, setRoles] = useState<Record<string, Role>>({})
  const [name, setName] = useState('Mi equipo')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Which role the picker is filling, or null when closed. */
  const [picking, setPicking] = useState<Role | null>(null)

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

  const starterIds = useMemo(
    () => Object.keys(roles).filter((id) => roles[id] === 'starter'),
    [roles],
  )
  const benchIds = useMemo(
    () => Object.keys(roles).filter((id) => roles[id] === 'bench'),
    [roles],
  )
  const starterCards = useMemo(
    () => starterIds.map((id) => byId[id]).filter(Boolean).sort(bySquadOrder),
    [starterIds, byId],
  )
  const benchCards = useMemo(
    () => benchIds.map((id) => byId[id]).filter(Boolean).sort(bySquadOrder),
    [benchIds, byId],
  )

  const validation = validateSquad(starterCards, benchCards)
  const remaining = POINT_CAP - validation.cost
  const overCap = validation.cost > POINT_CAP

  // Candidates for the open picker: not already picked, and affordable. Hiding
  // what can't be added is the whole point — the old grid let you tap a card
  // that silently did nothing.
  const available = useMemo(
    () => cards.filter((c) => !roles[c.id] && c.cost <= remaining),
    [cards, roles, remaining],
  )
  const { filtered, state } = useCardFilters(available, getCard, {
    initialSort: 'position',
  })

  const add = useCallback(
    (id: string, role: Role) => {
      setMessage(null)
      setRoles((prev) => ({ ...prev, [id]: role }))
      setPicking(null)
    },
    [],
  )

  const remove = useCallback((id: string) => {
    setMessage(null)
    setRoles((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

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

  const startersFull = starterCards.length >= STARTER_COUNT
  const benchFull = benchCards.length >= MAX_BENCH

  return (
    <div className="flex flex-col gap-4 pb-4">
      <input
        className="rounded-xl bg-black/30 px-4 py-2 font-display text-xl font-bold outline-none ring-1 ring-white/10 focus:ring-grass-400"
        value={name}
        aria-label="Nombre del equipo"
        onChange={(e) => setName(e.target.value)}
      />

      {/* Sticky status bar. It parks directly under the TopBar, whose height is
          --topbar-h (index.css) — and which is taller above md, where it carries
          the nav tabs. Was a hard-coded pixel constant; don't reintroduce one. */}
      <div className="card-surface sticky top-topbar z-10 flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 text-sm">
          <div className="tabular-nums">
            <span className="text-slate-400">Titulares </span>
            <span className="font-bold">
              {starterCards.length}/{STARTER_COUNT}
            </span>
            <span className="text-slate-400"> · Banquillo </span>
            <span className="font-bold">
              {benchCards.length}/{MAX_BENCH}
            </span>
          </div>
          <div className={`tabular-nums ${overCap ? 'text-red-400' : 'text-slate-400'}`}>
            Coste{' '}
            <span className="font-bold">
              {validation.cost}/{POINT_CAP}
            </span>{' '}
            pts
          </div>
          <div
            className="mt-1 h-1 w-28 overflow-hidden rounded-full bg-white/10"
            role="presentation"
          >
            <div
              className={`h-full rounded-full transition-all ${
                overCap ? 'bg-red-400' : 'bg-grass-400'
              }`}
              style={{ width: `${Math.min(100, (validation.cost / POINT_CAP) * 100)}%` }}
            />
          </div>
        </div>
        <button
          className="btn-primary shrink-0"
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

      {loading && <p className="text-slate-500">Cargando…</p>}

      {!loading && cards.length === 0 && (
        <p className="text-slate-500">
          No tienes cartas todavía. Abre un sobre en la tienda.
        </p>
      )}

      {!loading && cards.length > 0 && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xs uppercase tracking-widest text-slate-500">
              Titulares · {starterCards.length}/{STARTER_COUNT}
            </h2>
            {/* 6 columns at lg, not Colección's 5: the squad wants tidy, not
                dense. 11 titulares + the AddSlot is 12, and the bench's 5 + 1 is
                6 — both tile exactly, with no ragged last row. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {starterCards.map((card) => (
                <SquadCard
                  key={card.id}
                  card={card}
                  role="starter"
                  onRemove={() => remove(card.id)}
                />
              ))}
              {!startersFull && (
                <AddSlot label="Añadir titular" onClick={() => setPicking('starter')} />
              )}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-display text-xs uppercase tracking-widest text-slate-500">
              Suplentes · {benchCards.length}/{MAX_BENCH}
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
              {benchCards.map((card) => (
                <SquadCard
                  key={card.id}
                  card={card}
                  role="bench"
                  onRemove={() => remove(card.id)}
                />
              ))}
              {!benchFull && (
                <AddSlot label="Añadir suplente" onClick={() => setPicking('bench')} />
              )}
            </div>
          </section>
        </>
      )}

      <Sheet
        open={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'bench' ? 'Elegir suplente' : 'Elegir titular'}
      >
        <CardFilters state={state} count={filtered.length} />
        <p className="shrink-0 text-xs tabular-nums text-slate-400">
          Te quedan <span className="font-bold text-grass-400">{remaining} pts</span> · no se
          muestran las cartas que no caben
        </p>
        <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pb-2 md:grid-cols-4">
          {filtered.map((card) => (
            <Naipe
              key={card.id}
              card={card}
              onClick={() => picking && add(card.id, picking)}
            />
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="pb-4 text-sm text-slate-500">
            {available.length === 0
              ? `No te queda ninguna carta de ${remaining} pts o menos.`
              : 'Ninguna carta coincide con esos filtros.'}
          </p>
        )}
      </Sheet>
    </div>
  )
}
