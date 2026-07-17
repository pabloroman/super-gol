import type { Rarity } from '@/lib/types'
import type { PositionGroup } from '@/cards/positions'
import { POSITION_ABBR, POSITION_ORDER } from './positions'
import { SORT_LABEL, type CardFilterState, type SortKey } from './useCardFilters'

const RARITY_OPTIONS: { value: Rarity; label: string }[] = [
  { value: 'comun', label: 'Común' },
  { value: 'frecuente', label: 'Frecuente' },
  { value: 'rara', label: 'Rara' },
]

const SORT_OPTIONS = Object.keys(SORT_LABEL) as SortKey[]

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
        on ? 'bg-grass-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  )
}

const select =
  'rounded-lg bg-black/30 px-2 py-1 text-xs text-slate-300 outline-none ring-1 ring-white/10 focus:ring-grass-400'

export function CardFilters({
  state,
  count,
  searchLabel = 'Buscar jugador o club',
}: {
  state: CardFilterState
  count: number
  /** What the search actually covers. The admin catalog also matches the id. */
  searchLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <input
        type="search"
        value={state.query}
        onChange={(e) => state.setQuery(e.target.value)}
        placeholder={`${searchLabel}…`}
        aria-label={searchLabel}
        className="w-full rounded-xl bg-black/30 px-3 py-2 text-sm outline-none ring-1 ring-white/10 placeholder:text-slate-500 focus:ring-grass-400"
      />

      <div className="flex flex-wrap gap-1.5">
        <Chip on={state.position === null} onClick={() => state.setPosition(null)}>
          Todas
        </Chip>
        {POSITION_ORDER.map((p: PositionGroup) => (
          <Chip
            key={p}
            on={state.position === p}
            onClick={() => state.setPosition(state.position === p ? null : p)}
          >
            {POSITION_ABBR[p]}
          </Chip>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <select
            className={select}
            aria-label="Filtrar por rareza"
            value={state.rarity ?? ''}
            onChange={(e) => state.setRarity((e.target.value || null) as Rarity | null)}
          >
            <option value="">Toda rareza</option>
            {RARITY_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <select
            className={select}
            aria-label="Ordenar por"
            value={state.sort}
            onChange={(e) => state.setSort(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>

        <span className="shrink-0 text-xs tabular-nums text-slate-500">
          {state.active ? (
            <button
              type="button"
              onClick={state.clear}
              className="text-grass-400 hover:underline"
            >
              {count} · Quitar filtros
            </button>
          ) : (
            `${count} cartas`
          )}
        </span>
      </div>
    </div>
  )
}
