import { useState } from 'react'
import type { Card } from '@/lib/types'
import { ABILITY_META } from '@/game/abilities'
import { abilityValue } from '@/game/ratings'
import { crestUrl } from '@/cards/clubs'
import { naipeFactors } from './factors'
import { physicalLine } from './card-data'

/**
 * The Super Gol card, reproduced from the physical naipe (Naipes Heraclio
 * Fournier, 1995). Anatomy and every rule below come from
 * docs/rulebook/pages/page-02.md — «LA CARTA:».
 *
 * The card is a fixed 62×95 aspect whose type has to track its width, which no
 * fixed Tailwind text step can do. So the root is a **container** and everything
 * inside is sized in `cqw` (1cqw = 1% of the card's width): the naipe fills
 * whatever box it's given and stays internally proportional from the 40px chip
 * in the picker up to the full card in the sheet.
 */

export type NaipeVariant = 'mini' | 'full'

/** Portrait; falls back to the initial when there's no photo or it 404s. */
function Portrait({ card, quantity }: { card: Card; quantity?: number }) {
  const [failed, setFailed] = useState(false)
  const show = card.image_url && !failed
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-300 to-slate-600">
      {show ? (
        <img
          src={card.image_url!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-display font-bold text-white/30"
          style={{ fontSize: '42cqw' }}
          aria-hidden
        >
          {card.name.slice(0, 1)}
        </div>
      )}
      {/* Duplicates are a digital-only concern — the physical card has no such
          mark — so it sits on the photo rather than colliding with the name. */}
      {quantity && quantity > 1 ? (
        <span
          className="absolute left-[3%] top-[3%] rounded bg-black/80 px-1 py-0.5 font-bold leading-none text-white"
          style={{ fontSize: '7cqw' }}
        >
          ×{quantity}
        </span>
      ) : null}
    </div>
  )
}

/** Club crest. Silent when we have no id for the slug — better than a broken img. */
function Crest({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false)
  const url = crestUrl(card.club_slug)
  if (!url || failed) return null
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: '17cqw', height: '17cqw' }}
    />
  )
}

/**
 * Demarcación — «un mini-campo de 5 columnas × 6 filas con la zona del jugador
 * en rojo» (page 2). Red is where the player's factors are usable; green is the
 * rest. The card's frame is attacking-up (row 0 = the attacking end), which is
 * the frame ZONE_GRIDS already uses.
 *
 * Advanced game only — the basic game is played «sin demarcación» (page 11) — so
 * it is printed but inert, exactly as on the cardboard.
 */
function Demarcacion({ grid }: { grid: boolean[][] }) {
  return (
    <div
      className="grid shrink-0 gap-px bg-black/40 p-px"
      style={{
        gridTemplateColumns: `repeat(${grid[0]?.length ?? 5}, 1fr)`,
        width: '21cqw',
      }}
      aria-hidden
    >
      {grid.flatMap((row, r) =>
        row.map((live, c) => (
          <span
            key={`${r}-${c}`}
            className={`aspect-square ${live ? 'bg-demarc-red' : 'bg-demarc-green'}`}
          />
        )),
      )}
    </div>
  )
}

export function Naipe({
  card,
  variant = 'mini',
  quantity,
  onClick,
  selected,
  className = '',
}: {
  card: Card
  variant?: NaipeVariant
  quantity?: number
  onClick?: () => void
  selected?: boolean
  /** Sizing lives with the caller — the naipe fills whatever box it's given. */
  className?: string
}) {
  const factors = naipeFactors(card)
  const showLabels = variant === 'full'
  const physical = physicalLine(card)

  // Only interactive when it does something. The old CardTile rendered a
  // <button> even with no onClick, leaving Colección and Tienda full of
  // focusable controls that did nothing. (This is also why the hover lift below
  // needs no cursor-pointer: Preflight already sets it on <button>, and Tag is a
  // button exactly when onClick exists.)
  //
  // The lift is md:hover:, not hover:. Tailwind emits :hover unconditionally
  // here (no future.hoverOnlyWhenSupported), and a touch browser fires :hover on
  // tap and leaves it stuck — so a plain hover: would leave every tapped card
  // hovering on a phone, on the most-rendered component in the app.
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick, 'aria-label': card.name } : {})}
      style={{ containerType: 'inline-size' }}
      className={`aspect-naipe w-full rounded-[3%] bg-naipe-white p-[4%] shadow-lg shadow-black/50 ${
        onClick
          ? 'transition md:hover:-translate-y-0.5 md:hover:shadow-xl md:hover:shadow-black/60 active:scale-[0.98]'
          : ''
      } ${
        selected ? 'ring-[3px] ring-grass-400 ring-offset-1 ring-offset-pitch-900' : ''
      } ${className}`}
    >
      <div className="relative flex h-full flex-col overflow-hidden bg-black text-left">
        {/* Name band */}
        <div className="flex shrink-0 items-center justify-between gap-1 bg-gradient-to-b from-naipe-band to-naipe-band-dark px-[4%] py-[2%]">
          <span
            className="truncate font-display font-bold uppercase leading-tight text-white"
            style={{ fontSize: '13cqw' }}
          >
            {card.name}
          </span>
          <Crest card={card} />
        </div>

        <Portrait card={card} quantity={quantity} />

        {/* Data band: ficha, personal data, demarcación */}
        <div className="flex shrink-0 items-center gap-[2%] bg-gradient-to-b from-naipe-band to-naipe-band-dark px-[3%] py-[2%]">
          <span
            className="grid shrink-0 place-items-center rounded-full bg-white font-display font-bold leading-none tabular-nums text-black"
            style={{ width: '17cqw', height: '17cqw', fontSize: '9.5cqw' }}
            title="Ficha"
          >
            {card.cost}
          </span>

          {/* Condensed, like the print — and it buys the ~25% extra characters
              that keep «23/03/68 - 1,87» from truncating mid-value. */}
          <span
            className="min-w-0 flex-1 font-display leading-snug text-white"
            style={{ fontSize: '6.6cqw' }}
          >
            {card.full_name && <span className="block truncate">{card.full_name}</span>}
            {physical && <span className="block truncate">{physical}</span>}
          </span>

          {card.zone_grid?.length ? <Demarcacion grid={card.zone_grid} /> : null}
        </div>

        {/* Factor strip — variable length, per page 2 */}
        {factors.length > 0 && (
          <div className="flex shrink-0 bg-naipe-white">
            {factors.map((k) => (
              <span
                key={k}
                className="min-w-0 flex-1 border-l border-black/20 px-px py-[1%] text-center first:border-l-0"
              >
                <span
                  className="block whitespace-nowrap font-display font-bold leading-tight text-black"
                  style={{ fontSize: showLabels ? '6.2cqw' : '7.5cqw' }}
                >
                  {ABILITY_META[k].abbr}
                  {showLabels ? ': ' : ' '}
                  <span className="text-factor">{abilityValue(card, k)}</span>
                </span>
                {showLabels && (
                  <span
                    className="block truncate font-display font-semibold uppercase leading-tight text-black/75"
                    style={{ fontSize: '3.3cqw' }}
                  >
                    {ABILITY_META[k].label}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
    </Tag>
  )
}
