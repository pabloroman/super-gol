import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { XMarkIcon } from '@heroicons/react/24/solid'
import { useAuth } from '@/auth/AuthProvider'
import { fetchActiveSquad, fetchCollection, saveSquad } from '@/data/api'
import { Naipe } from '@/ui/naipe/Naipe'
import { Sheet } from '@/ui/Sheet'
import { Toast } from '@/ui/Toast'
import { CardFilters } from '@/ui/CardFilters'
import { useCardFilters } from '@/ui/useCardFilters'
import {
  POSITION_LABEL,
  POSITION_ORDER,
  isPositionGroup,
  positionAbbr,
  positionRank,
} from '@/ui/positions'
import { POINT_CAP, STARTER_COUNT, squadCounts, validateSquad } from '@/game/squad'
import type { PositionGroup } from '@/cards/positions'
import type { Card } from '@/lib/types'

const getCard = (c: Card) => c

/** The three outfield lines — the only ones a keeper can't join. */
const OUTFIELD_POSITIONS: PositionGroup[] = ['DF', 'MF', 'FW']

/** Plural section titles (POSITION_LABEL is the singular the picker/chips use). */
const SECTION_TITLE: Record<PositionGroup, string> = {
  GK: 'Portero',
  DF: 'Defensas',
  MF: 'Medios',
  FW: 'Delanteros',
}

const ADD_LABEL: Record<PositionGroup, string> = {
  GK: 'Añadir portero',
  DF: 'Añadir defensa',
  MF: 'Añadir medio',
  FW: 'Añadir delantero',
}

/** The position group a card belongs to, or null for unrecognised data. */
const groupOf = (c: Card): PositionGroup | null =>
  isPositionGroup(c.position) ? c.position : null

/** What's wrong with a line, in words — feeds the small amber hint per section. */
function sectionHint(group: PositionGroup, n: number): string | null {
  if (group === 'GK') {
    if (n === 0) return 'Falta el portero'
    if (n > 1) return 'Solo puede haber 1 portero'
    return null
  }
  return n < 1 ? 'Añade al menos 1' : null
}

/** Keeper first, then out towards the opposition goal; ficha descending within a line. */
function bySquadOrder(a: Card, b: Card) {
  return (
    positionRank(a.position) - positionRank(b.position) ||
    b.cost - a.cost ||
    a.full_name.localeCompare(b.full_name, 'es')
  )
}

function SquadCard({ card, onRemove }: { card: Card; onRemove: () => void }) {
  const pos = positionAbbr(card.position)
  return (
    <div className="relative">
      <Naipe card={card} selected />
      {/* No TITULAR badge: with no bench, every card here is one — the
          demarcación chip is the only thing left worth printing. */}
      <div className="absolute -top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1">
        {pos && (
          <span className="rounded-full bg-black/85 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-slate-300">
            {pos}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Quitar a ${card.full_name} del equipo`}
        className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/85 text-slate-300 ring-1 ring-white/20 transition hover:bg-red-500 hover:text-white"
      >
        <XMarkIcon className="h-4 w-4" aria-hidden />
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

/**
 * The picker that opens per line. Multi-select for the outfield lines (tap to
 * toggle, commit the batch at once — the old picker closed after every single
 * pick), single-select-and-replace for the keeper so «exactly one portero» can't
 * be broken from the UI. Cards that no longer fit the tentative budget dim rather
 * than vanish, keeping the "never offer what can't be added" behaviour.
 */
function SquadPicker({
  group,
  pool,
  committedCost,
  maxSelectable,
  singleSelect,
  onConfirm,
}: {
  group: PositionGroup
  pool: Card[]
  /** Cost already locked in, excluding anything this picker will replace. */
  committedCost: number
  /** How many cards this picker may add (ignored when singleSelect). */
  maxSelectable: number
  singleSelect: boolean
  onConfirm: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const { filtered, state } = useCardFilters(pool, getCard, {
    initialSort: 'position',
    initialPosition: group,
  })

  const selectedCost = useMemo(
    () => pool.reduce((sum, c) => (selected.has(c.id) ? sum + c.cost : sum), 0),
    [pool, selected],
  )
  const committedRemaining = POINT_CAP - committedCost
  // Single-select replaces, so the tentative pick never eats into the budget of
  // the alternatives — only the committed cost does.
  const effectiveRemaining = singleSelect
    ? committedRemaining
    : committedRemaining - selectedCost
  const atCapacity = !singleSelect && selected.size >= maxSelectable

  const toggle = useCallback(
    (id: string) => {
      setSelected((prev) => {
        if (prev.has(id)) {
          const next = new Set(prev)
          next.delete(id)
          return next
        }
        if (singleSelect) return new Set([id])
        const next = new Set(prev)
        next.add(id)
        return next
      })
    },
    [singleSelect],
  )

  return (
    <>
      <CardFilters
        state={state}
        count={filtered.length}
        hidePosition={group === 'GK'}
        positions={OUTFIELD_POSITIONS}
      />
      <p className="shrink-0 text-xs tabular-nums text-slate-400">
        Te quedan <span className="font-bold text-grass-400">{committedRemaining} pts</span>
        {selected.size > 0 && <> · seleccionado {selectedCost} pts</>}
      </p>
      <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pb-2 md:grid-cols-4">
        {filtered.map((card) => {
          const isSelected = selected.has(card.id)
          const disabled = !isSelected && (card.cost > effectiveRemaining || atCapacity)
          return (
            <div key={card.id} className={disabled ? 'opacity-40 pointer-events-none' : ''}>
              <Naipe
                card={card}
                selected={isSelected}
                onClick={disabled ? undefined : () => toggle(card.id)}
              />
            </div>
          )
        })}
      </div>
      {filtered.length === 0 && (
        <p className="pb-2 text-sm text-slate-500">
          {pool.length === 0
            ? group === 'GK'
              ? 'No tienes ningún portero disponible.'
              : 'No te quedan jugadores de campo disponibles.'
            : 'Ninguna carta coincide con esos filtros.'}
        </p>
      )}
      <button
        type="button"
        className="btn-primary shrink-0"
        disabled={selected.size === 0}
        onClick={() => onConfirm(Array.from(selected))}
      >
        {group === 'GK'
          ? 'Elegir portero'
          : `Añadir${selected.size > 0 ? ` (${selected.size}) · ${selectedCost} pts` : ''}`}
      </button>
    </>
  )
}

export function SquadBuilder() {
  const { refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [cards, setCards] = useState<Card[]>([])
  const [pickedIds, setPickedIds] = useState<string[]>([])
  const [name, setName] = useState('Mi equipo')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerGroup, setPickerGroup] = useState<PositionGroup | null>(null)

  useEffect(() => {
    Promise.all([fetchCollection(), fetchActiveSquad()])
      .then(([collection, squad]) => {
        setCards(collection.map((e) => e.card))
        if (squad) {
          setName(squad.name)
          setPickedIds(squad.slots.map((s) => s.card_id))
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const byId = useMemo(
    () => Object.fromEntries(cards.map((c) => [c.id, c])),
    [cards],
  )

  const picked = useMemo(() => new Set(pickedIds), [pickedIds])
  const starterCards = useMemo(
    () => pickedIds.map((id) => byId[id]).filter(Boolean).sort(bySquadOrder),
    [pickedIds, byId],
  )

  const validation = validateSquad(starterCards)
  const counts = squadCounts(starterCards)
  const overCap = validation.cost > POINT_CAP

  // The picked cards, bucketed into the four sections (already keeper-first,
  // ficha-descending from bySquadOrder).
  const grouped = useMemo(() => {
    const g: Record<PositionGroup, Card[]> = { GK: [], DF: [], MF: [], FW: [] }
    for (const c of starterCards) {
      const grp = groupOf(c)
      if (grp) g[grp].push(c)
    }
    return g
  }, [starterCards])

  // Everything not already in the squad is a candidate; the picker dims what
  // can't be afforded rather than hiding it.
  const available = useMemo(
    () => cards.filter((c) => !picked.has(c.id)),
    [cards, picked],
  )

  // Props for whichever picker is open. The keeper picker frees the current
  // keeper's cost (it's about to be replaced) and is scoped to keepers only.
  const pickerProps = useMemo(() => {
    if (!pickerGroup) return null
    if (pickerGroup === 'GK') {
      const existingGkCost = grouped.GK.reduce((sum, c) => sum + c.cost, 0)
      return {
        group: 'GK' as PositionGroup,
        pool: available.filter((c) => groupOf(c) === 'GK'),
        committedCost: validation.cost - existingGkCost,
        maxSelectable: 1,
        singleSelect: true,
      }
    }
    return {
      group: pickerGroup,
      pool: available.filter((c) => {
        const g = groupOf(c)
        return g !== null && g !== 'GK'
      }),
      committedCost: validation.cost,
      maxSelectable: STARTER_COUNT - starterCards.length,
      singleSelect: false,
    }
  }, [pickerGroup, available, grouped.GK, validation.cost, starterCards.length])

  const commit = useCallback(
    (ids: string[]) => {
      if (!pickerGroup) return
      setSaved(false)
      setPickedIds((prev) => {
        // Replacing the keeper: drop any existing GK first (also repairs a legacy
        // squad that somehow carried two).
        const base =
          pickerGroup === 'GK'
            ? prev.filter((id) => {
                const c = byId[id]
                return !c || groupOf(c) !== 'GK'
              })
            : prev
        return [...base, ...ids]
      })
      setPickerGroup(null)
    },
    [pickerGroup, byId],
  )

  const remove = useCallback((id: string) => {
    setSaved(false)
    setPickedIds((prev) => prev.filter((x) => x !== id))
  }, [])

  async function save() {
    setBusy(true)
    setError(null)
    setSaved(false)
    try {
      await saveSquad(name, pickedIds)
      await refreshProfile()
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const full = starterCards.length >= STARTER_COUNT

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

      {!loading &&
        cards.length > 0 &&
        POSITION_ORDER.map((group) => {
          const lineCards = grouped[group]
          const n = counts[group]
          const hint = sectionHint(group, n)
          // GK: add when empty (and there's room), otherwise offer a swap.
          const canAdd =
            group === 'GK'
              ? n >= 1 || !full
              : !full
          const addLabel = group === 'GK' && n >= 1 ? 'Cambiar portero' : ADD_LABEL[group]
          return (
            <section key={group} className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-display text-xs uppercase tracking-widest text-slate-500">
                  {SECTION_TITLE[group]} · {group === 'GK' ? `${n}/1` : n}
                </h2>
                {hint && <span className="text-[11px] text-amber-400">{hint}</span>}
              </div>
              {/* 6 columns at lg, not Colección's 5: a squad is a fixed, small set
                  and wants to be read at a glance, not scrolled. */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {lineCards.map((card) => (
                  <SquadCard key={card.id} card={card} onRemove={() => remove(card.id)} />
                ))}
                {canAdd && (
                  <AddSlot label={addLabel} onClick={() => setPickerGroup(group)} />
                )}
              </div>
            </section>
          )
        })}

      <Sheet
        open={pickerGroup !== null}
        onClose={() => setPickerGroup(null)}
        title={pickerGroup ? `Elegir ${POSITION_LABEL[pickerGroup]!.toLowerCase()}` : ''}
        size="wide"
      >
        {pickerProps && (
          <SquadPicker
            key={pickerProps.group}
            group={pickerProps.group}
            pool={pickerProps.pool}
            committedCost={pickerProps.committedCost}
            maxSelectable={pickerProps.maxSelectable}
            singleSelect={pickerProps.singleSelect}
            onConfirm={commit}
          />
        )}
      </Sheet>

      <Toast
        open={saved}
        onClose={() => setSaved(false)}
        message="Equipo guardado"
        action={{ label: 'Jugar partido', onClick: () => navigate('/play') }}
      />
    </div>
  )
}
