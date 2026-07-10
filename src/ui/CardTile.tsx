import { useState } from 'react'
import type { Card, Rarity } from '@/lib/types'
import { ABILITY_META, ABILITY_ORDER } from '@/game/abilities'

const RARITY_RING: Record<Rarity, string> = {
  comun: 'ring-common/40',
  frecuente: 'ring-frequent/60',
  rara: 'ring-rare/70',
}

const RARITY_LABEL: Record<Rarity, string> = {
  comun: 'Común',
  frecuente: 'Frecuente',
  rara: 'Rara',
}

/** Player portrait with a silhouette fallback when there's no photo (or it fails to load). */
function PlayerPhoto({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false)
  const show = card.image_url && !failed
  return (
    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/10 ring-2 ring-white/15">
      {show ? (
        <img
          src={card.image_url!}
          alt={card.name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-display text-lg font-bold text-slate-400">
          {card.name.slice(0, 1)}
        </div>
      )}
    </div>
  )
}

/** A miniature pitch-zone grid (green = effective). */
function ZoneGrid({ grid }: { grid: boolean[][] }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {grid.map((row, r) => (
        <div key={r} className="flex gap-[2px]">
          {row.map((cell, c) => (
            <span
              key={c}
              className={`h-1.5 w-1.5 rounded-[1px] ${cell ? 'bg-grass-400' : 'bg-white/10'}`}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardTile({
  card,
  quantity,
  onClick,
  selected,
}: {
  card: Card
  quantity?: number
  onClick?: () => void
  selected?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card-surface relative flex w-full flex-col p-3 text-left ring-1 ${
        RARITY_RING[card.rarity]
      } ${selected ? 'outline outline-2 outline-grass-400' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <PlayerPhoto card={card} />
          <div className="min-w-0">
            <div className="truncate font-display text-lg font-bold uppercase tracking-wide">
              {card.name}
            </div>
            <div className="truncate text-xs text-slate-400">{card.club}</div>
          </div>
        </div>
        <div className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white ring-2 ring-white/20">
          {card.cost}
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between">
        <div className="grid grid-cols-5 gap-x-2 gap-y-0.5 text-[10px] text-slate-300">
          {ABILITY_ORDER.map((k) => (
            <div key={k} className="flex items-baseline gap-0.5">
              <span className="text-slate-500">{ABILITY_META[k].abbr}</span>
              <span className="font-semibold text-slate-100">{card.abilities[k] ?? 0}</span>
            </div>
          ))}
        </div>
        {card.zone_grid?.length ? <ZoneGrid grid={card.zone_grid} /> : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-slate-500">
          {card.position ?? '—'} · {RARITY_LABEL[card.rarity]}
        </span>
        {quantity && quantity > 1 ? (
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-semibold text-slate-200">
            ×{quantity}
          </span>
        ) : null}
      </div>
    </button>
  )
}
