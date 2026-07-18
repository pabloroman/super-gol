import { CurrencyDollarIcon } from '@heroicons/react/24/solid'

/**
 * The game's coin currency mark. Heroicons ships no gold-coin glyph, so this is
 * the single place that maps our currency to one — every coin amount in the app
 * (balances, prices, rewards) renders through it, and swapping the glyph or its
 * tint is a one-line change here. Sized in `em` so it tracks the surrounding
 * text and inherits `currentColor`, which is already `text-rare` at every site.
 */
export function Coin({ className = '' }: { className?: string }) {
  return (
    <CurrencyDollarIcon
      aria-hidden
      className={`inline-block h-[1em] w-[1em] shrink-0 align-[-0.15em] ${className}`}
    />
  )
}
