import { useState } from 'react'
import type { EngineCard } from '@/game/board'

/**
 * The player's photo, for the match screens' fichas and chips. The same portrait the
 * naipe prints, cropped to whatever box the caller gives it — so the board ficha, the
 * action-menu token and the Plantilla row all put the same face on the same player.
 *
 * It reads `image_url` off the slim `EngineCard` embedded in the match state, which is
 * why that field is carried there at all. Falls back to the initial on a card with no
 * photo, on a 404, and on a session persisted before the field existed — the fallback
 * is the normal case for a locally-seeded catalog, not an error path.
 *
 * The photos are cut-out headshots on a transparent background, so the gradient behind
 * is load-bearing: without it a transparent PNG would show the pitch through the face.
 * Sizing, rounding and `object-position` belong to the caller (`className`), the way the
 * naipe leaves its own box to whoever renders it.
 */
export function PlayerFace({
  card,
  className = '',
  /** Where the crop sits — raised toward the face when the box is wider than it is tall. */
  objectPosition = 'center 20%',
}: {
  card: EngineCard
  className?: string
  objectPosition?: string
}) {
  const [failed, setFailed] = useState(false)
  const show = Boolean(card.image_url) && !failed

  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden bg-gradient-to-br from-slate-300 to-slate-600 ${className}`}
    >
      {show ? (
        <img
          src={card.image_url!}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          style={{ objectPosition }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-display font-bold uppercase leading-none text-white/40">
          {card.full_name.slice(0, 1)}
        </span>
      )}
    </span>
  )
}
