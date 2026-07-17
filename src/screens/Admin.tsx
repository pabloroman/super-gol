import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { adminDeleteCard, adminUpsertCards, fetchCatalog } from '@/data/api'
import { ABILITY_META, ABILITY_ORDER } from '@/game/abilities'
import { ZONE_GRIDS, type PositionGroup } from '@/cards/positions'
import { cardsToCsv, parseCardsCsv, type ImportedCard } from '@/cards/csv'
import { Sheet } from '@/ui/Sheet'
import { CardFilters } from '@/ui/CardFilters'
import { useCardFilters } from '@/ui/useCardFilters'
import { positionAbbr } from '@/ui/positions'
import type { AbilityKey, Card, Rarity } from '@/lib/types'

const POSITIONS: PositionGroup[] = ['GK', 'DF', 'MF', 'FW']
const RARITIES: Rarity[] = ['comun', 'frecuente', 'rara']

// Module scope, not inline: this is a useCardFilters useMemo dependency, so a
// fresh identity each render would re-filter and re-sort 518 cards on every
// unrelated state change. Colección and SquadBuilder hoist theirs for the same
// reason.
const getCard = (c: Card) => c

function blankCard(): Card {
  return {
    id: '',
    name: '',
    full_name: null,
    club: null,
    club_slug: null,
    nationality: null,
    birthplace: null,
    birth_date: null,
    height_cm: null,
    weight_kg: null,
    position: 'MF',
    cost: 1,
    rarity: 'comun',
    is_starter: false,
    abilities: {},
    zone_grid: ZONE_GRIDS.MF,
    image_url: null,
  }
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- per-card editor (modal) ----------
function CardEditor({
  initial,
  isNew,
  onClose,
  onSaved,
  onDeleted,
}: {
  initial: Card
  isNew: boolean
  onClose: () => void
  onSaved: (card: Card) => void
  onDeleted: (id: string) => void
}) {
  const [card, setCard] = useState<Card>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Card>(k: K, v: Card[K]) => setCard((c) => ({ ...c, [k]: v }))
  const setNum = (k: 'height_cm' | 'weight_kg', raw: string) =>
    set(k, raw === '' ? null : Number(raw))
  const setStr = (k: 'full_name' | 'club' | 'club_slug' | 'nationality' | 'birthplace' | 'birth_date' | 'image_url', raw: string) =>
    set(k, raw === '' ? null : raw)
  const setAbility = (key: AbilityKey, raw: string) => {
    const v = raw === '' ? 0 : Math.max(0, Math.min(3, Number(raw) || 0))
    setCard((c) => {
      const abilities = { ...c.abilities }
      if (v === 0) delete abilities[key]
      else abilities[key] = v
      return { ...c, abilities }
    })
  }
  async function save() {
    if (!card.id.trim() || !card.name.trim()) {
      setError('id and name are required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await adminUpsertCards([card])
      onSaved(card)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete card "${card.id}"?`)) return
    setBusy(true)
    setError(null)
    try {
      await adminDeleteCard(card.id)
      onDeleted(card.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = 'w-full rounded bg-black/30 px-2 py-1 text-sm ring-1 ring-white/10'

  return (
    // On Sheet, which brings the portal, focus trap, Escape, scroll lock and
    // focus restore this modal never had — and, because it portals out of the
    // app column, the room to be four fields wide above md.
    <Sheet open onClose={onClose} title={isNew ? 'Nueva carta' : card.id} size="wide">
      {/* A form so Enter saves. Every button that is NOT save must say so
          explicitly: the default type inside a form is submit, which would turn
          "Cancelar" into a second Guardar. Validation stays manual — native
          `required` bubbles are English and unstylable. */}
      <form
        className="min-h-0 overflow-y-auto"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        {/* The labels are the schema on purpose: club_slug here matching
            club_slug in the CSV header is a feature of a data tool. */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
          <label className="col-span-1 text-xs text-slate-400 md:col-span-2">
            id
            <input className={field} value={card.id} disabled={!isNew}
              onChange={(e) => set('id', e.target.value)} />
          </label>
          <label className="col-span-1 text-xs text-slate-400 md:col-span-2">
            name
            <input className={field} value={card.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="col-span-2 text-xs text-slate-400 md:col-span-4">
            full_name
            <input className={field} value={card.full_name ?? ''} onChange={(e) => setStr('full_name', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">club
            <input className={field} value={card.club ?? ''} onChange={(e) => setStr('club', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">club_slug
            <input className={field} value={card.club_slug ?? ''} onChange={(e) => setStr('club_slug', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">nationality
            <input className={field} value={card.nationality ?? ''} onChange={(e) => setStr('nationality', e.target.value)} />
          </label>
          {/* birthplace was wired end to end — typed in setStr, initialized in
              blankCard, carried by the CSV, and *printed on the naipe* — but the
              input was never written, so the card showed a field no admin could
              fill and the generator leaves empty on all 518 rows. */}
          <label className="text-xs text-slate-400">birthplace
            <input className={field} value={card.birthplace ?? ''} onChange={(e) => setStr('birthplace', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">birth_date
            <input className={field} value={card.birth_date ?? ''} placeholder="YYYY-MM-DD" onChange={(e) => setStr('birth_date', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">height_cm
            <input className={field} type="number" value={card.height_cm ?? ''} onChange={(e) => setNum('height_cm', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">weight_kg
            <input className={field} type="number" value={card.weight_kg ?? ''} onChange={(e) => setNum('weight_kg', e.target.value)} />
          </label>
          <label className="text-xs text-slate-400">position
            <select className={field} value={card.position ?? 'MF'} onChange={(e) => set('position', e.target.value)}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">rarity
            <select className={field} value={card.rarity} onChange={(e) => set('rarity', e.target.value as Rarity)}>
              {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">cost
            <input className={field} type="number" value={card.cost} onChange={(e) => set('cost', Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={card.is_starter} onChange={(e) => set('is_starter', e.target.checked)} />
            is_starter
          </label>
          <label className="col-span-2 text-xs text-slate-400 md:col-span-4">image_url
            <input className={field} value={card.image_url ?? ''} onChange={(e) => setStr('image_url', e.target.value)} />
          </label>
        </div>

        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-400">abilities (0–3)</div>
          {/* All 13 in one row above md — which is the shape of the naipe's own
              factor strip, so the form reads like the thing it edits. Below md
              it stays 5-wide and ragged; a phone has no room for thirteen. */}
          <div className="grid grid-cols-5 gap-2 md:grid-cols-[repeat(13,minmax(0,1fr))] md:gap-1.5">
            {ABILITY_ORDER.map((k) => (
              <label key={k} className="text-[10px] text-slate-500">
                {ABILITY_META[k].abbr}
                <input className={field} type="number" min={0} max={3}
                  value={card.abilities[k] ?? 0}
                  onChange={(e) => setAbility(k, e.target.value)} />
              </label>
            ))}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 text-xs text-slate-400">
            zone_grid{' '}
            <span className="text-slate-500">
              · demarcación (juego avanzado — no afecta al juego básico)
            </span>
          </div>
          {/* Read-only: the basic game is played «sin demarcación» (rulebook p.11), so
              this grid has no effect on the match engine. It is derived from the
              player's position and only used by the advanced game (not yet built). */}
          <div className="flex flex-col gap-1">
            {card.zone_grid.map((row, r) => (
              <div key={r} className="flex gap-1">
                {row.map((cell, col) => (
                  <div key={col}
                    className={`h-5 w-5 rounded-sm ${cell ? 'bg-grass-400/60' : 'bg-white/10'}`} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex items-center justify-between">
          {!isNew ? (
            <button type="button" onClick={() => void remove()} disabled={busy}
              className="text-sm text-red-400 transition hover:text-red-300">Eliminar</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5">Cancelar</button>
            <button type="submit" disabled={busy}
              className="rounded bg-grass-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-grass-400 disabled:opacity-50">
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </form>
    </Sheet>
  )
}

// ---------- CSV import ----------
function CsvImport({ existingIds, onImported }: { existingIds: Set<string>; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<{ cards: ImportedCard[]; errors: string[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMsg(null)
    setPreview(parseCardsCsv(await file.text()))
  }

  async function doImport() {
    if (!preview) return
    setBusy(true)
    setMsg(null)
    try {
      const n = await adminUpsertCards(preview.cards)
      setMsg(`Importadas ${n} cartas.`)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      onImported()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const created = preview ? preview.cards.filter((c) => !existingIds.has(c.id)).length : 0
  const updated = preview ? preview.cards.length - created : 0

  return (
    <div className="card-surface p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold">Importar CSV</h2>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => void onFile(e)}
          className="text-xs text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-slate-200" />
      </div>
      {preview && (
        <div className="mt-2 text-sm">
          <p className="text-slate-300">
            {preview.cards.length} válidas · <span className="text-grass-400">{created} nuevas</span> ·{' '}
            <span className="text-rare">{updated} actualizadas</span>
            {preview.errors.length > 0 && <span className="text-red-400"> · {preview.errors.length} errores</span>}
          </p>
          {preview.errors.length > 0 && (
            <ul className="mt-1 max-h-24 overflow-y-auto text-xs text-red-400">
              {preview.errors.slice(0, 20).map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          )}
          <button onClick={() => void doImport()} disabled={busy || preview.cards.length === 0}
            className="mt-2 rounded bg-grass-500 px-3 py-1.5 text-sm font-semibold text-black disabled:opacity-50">
            {busy ? 'Importando…' : `Importar ${preview.cards.length} cartas`}
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-slate-300">{msg}</p>}
    </div>
  )
}

// ---------- catalog row ----------
/**
 * One catalog row: a real <tr> in a real <table> above md, where the table
 * elements switch to flex/block below md so the same markup reads as the list it
 * has always been. Rendering once matters — 518 rows are unvirtualized already,
 * and a second hidden mobile copy would double the DOM for nothing.
 */
function CardRow({ card, onEdit }: { card: Card; onEdit: () => void }) {
  return (
    <tr
      onClick={onEdit}
      className="flex cursor-pointer items-center gap-3 border-b border-white/5 py-2 transition hover:bg-white/5 md:table-row md:border-0 md:py-0 md:[&>td]:border-b md:[&>td]:border-white/5 md:[&>td]:px-2 md:[&>td]:py-1.5"
    >
      <td className="block shrink-0 md:table-cell">
        <span className="block h-8 w-8 overflow-hidden rounded-full bg-white/10">
          {card.image_url && (
            <img src={card.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </span>
      </td>
      <td className="block min-w-0 flex-1 md:table-cell">
        {/* The row is clickable for the mouse, but the name stays a real button
            so keyboard and AT keep the affordance the old full-row button had.
            stopPropagation because the click would otherwise also reach the row
            handler — harmless while onEdit is idempotent, a double-fire the day
            it isn't. */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="block max-w-full truncate text-left text-sm font-semibold transition hover:text-grass-400"
        >
          {card.name}
        </button>
        <span className="block truncate text-xs text-slate-500 md:hidden">
          {card.club ?? '—'} · {positionAbbr(card.position) ?? '—'}
        </span>
        <span className="hidden truncate text-xs text-slate-500 lg:block">
          {card.full_name ?? ''}
        </span>
      </td>
      <td className="hidden font-mono text-xs text-slate-500 lg:table-cell">{card.id}</td>
      <td className="hidden text-sm text-slate-300 md:table-cell">{card.club ?? '—'}</td>
      {/* POR/DEF/MED/DEL, not the stored GK/DF/MF/FW: this is a browse view, and
          the UI is Spanish-only. The editor's <select> keeps the raw codes —
          there it is editing the stored value, so the code is the right thing. */}
      <td className="hidden text-sm text-slate-300 md:table-cell">
        {positionAbbr(card.position) ?? '—'}
      </td>
      <td className="block shrink-0 text-right text-xs tabular-nums text-slate-400 md:table-cell">
        {card.cost}
      </td>
      <td className="block shrink-0 text-xs text-slate-400 md:table-cell">{card.rarity}</td>
      <td className="hidden text-center text-xs lg:table-cell">{card.is_starter ? '✓' : '—'}</td>
      <td className="hidden text-xs text-slate-500 xl:table-cell">{card.nationality ?? '—'}</td>
    </tr>
  )
}

// ---------- screen ----------
export function Admin() {
  const { profile } = useAuth()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ card: Card; isNew: boolean } | null>(null)

  function reload() {
    setLoading(true)
    fetchCatalog()
      .then(setCards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(reload, [])

  const existingIds = useMemo(() => new Set(cards.map((c) => c.id)), [cards])
  // searchId: the admin catalog is the one place that wants to find a card by
  // its slug. Sorting by name because this is a catalog to look things up in,
  // not a shop window ranked by ficha.
  const { filtered, state } = useCardFilters(cards, getCard, {
    searchId: true,
    initialSort: 'name',
  })

  if (!profile?.is_admin) {
    return <p className="text-slate-400">No tienes acceso a esta sección.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold">Admin · Cartas</h1>
        <span className="text-sm text-slate-400">{cards.length}</span>
      </div>

      <CsvImport existingIds={existingIds} onImported={reload} />

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <CardFilters
            state={state}
            count={filtered.length}
            searchLabel="Buscar jugador, club o id"
          />
        </div>
        <div className="flex shrink-0 gap-2">
          <button onClick={() => setEditing({ card: blankCard(), isNew: true })}
            className="rounded bg-grass-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-grass-400">+ Nueva</button>
          <button onClick={() => downloadText('cards.csv', cardsToCsv(cards))}
            className="rounded bg-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/20">CSV</button>
        </div>
      </div>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* border-separate, not the default collapse: sticky <thead> loses its
          borders under border-collapse in Chrome. Same reason tbody uses per-cell
          borders rather than divide-y. */}
      <table className="block w-full md:table md:border-separate md:border-spacing-0">
        <thead className="hidden md:table-header-group">
          <tr className="text-left font-display text-xs uppercase tracking-widest text-slate-500 [&>th]:sticky [&>th]:top-topbar [&>th]:z-10 [&>th]:border-b [&>th]:border-white/10 [&>th]:bg-pitch-900 [&>th]:px-2 [&>th]:py-2">
            {/* Sticky goes on the th's — a <tr> is not a sticky container. With
                518 unvirtualized rows this is the single biggest win here. */}
            <th className="w-10" />
            <th>Nombre</th>
            <th className="hidden lg:table-cell">id</th>
            <th>Club</th>
            <th>Puesto</th>
            <th className="text-right">Ficha</th>
            <th>Rareza</th>
            <th className="hidden text-center lg:table-cell">Titular</th>
            <th className="hidden xl:table-cell">Nacionalidad</th>
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {filtered.map((c) => (
            <CardRow key={c.id} card={c} onEdit={() => setEditing({ card: c, isNew: false })} />
          ))}
        </tbody>
      </table>
      {!loading && filtered.length === 0 && <p className="text-slate-500">Sin resultados.</p>}

      {editing && (
        <CardEditor
          initial={editing.card}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSaved={(card) => {
            setCards((prev) => {
              const i = prev.findIndex((c) => c.id === card.id)
              if (i === -1) return [...prev, card]
              const next = [...prev]
              next[i] = card
              return next
            })
            setEditing(null)
          }}
          onDeleted={(id) => {
            setCards((prev) => prev.filter((c) => c.id !== id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
