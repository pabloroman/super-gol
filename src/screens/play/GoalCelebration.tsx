import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { GoalFlash } from './useInteractiveMatch'

/**
 * The goal celebration moment. A goal used to resume play with nothing more than the
 * score ticking up; this holds the match for a beat — a tinted "¡GOOOOL!" burst over
 * everything — until the player taps «Seguir», then play resumes (the hook gates the
 * AI's next jugada on this being dismissed).
 *
 * It portals to <body> and covers the viewport (like `Sheet`), so the burst is centred
 * regardless of how far the match has scrolled. It is NOT a `Sheet`: a Sheet is a titled,
 * dismiss-by-X dialog, and forcing a full-bleed celebration into that chrome would fight
 * it. It is interactive (one button) but the match underneath is paused and the veil eats
 * pointer events, so focusing «Seguir» + Enter/Escape to resume is enough — a full focus
 * trap would be machinery for a single control.
 *
 * Tuned by who scored: the human's goal is celebratory (gold), the rival's is a calmer,
 * muted beat — both pause the match, but a conceded goal shouldn't feel like a party.
 */
export function GoalCelebration({
  flash,
  onSeguir,
}: {
  flash: GoalFlash | null
  onSeguir: () => void
}) {
  const seguirRef = useRef<HTMLButtonElement>(null)
  const home = flash?.side === 'home'

  // Focus «Seguir» on each goal, subtly buzz the phone on the player's own, and let
  // Enter/Escape resume. Keyed on `nonce` so back-to-back goals re-run it.
  useEffect(() => {
    if (!flash) return
    seguirRef.current?.focus()
    if (home) navigator.vibrate?.(60)
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault()
        onSeguir()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash?.nonce])

  if (!flash) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div
        className={`absolute inset-0 backdrop-blur-sm ${home ? 'bg-pitch-950/80' : 'bg-black/80'}`}
        onClick={onSeguir}
        aria-hidden
      />
      <div
        role="alertdialog"
        aria-label={home ? '¡Gol!' : 'Gol del rival'}
        className="goal-cheer relative flex flex-col items-center gap-3 text-center"
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.3em] ${
            home ? 'text-grass-400' : 'text-slate-500'
          }`}
        >
          {home ? 'Tú' : 'Rival'}
        </p>

        {home && (
          <span className="text-4xl" aria-hidden>
            ⚽️
          </span>
        )}

        <p
          aria-live="assertive"
          className={`font-display font-extrabold leading-none ${
            home
              ? 'text-6xl text-rare drop-shadow-[0_2px_12px_rgba(245,179,1,0.35)] md:text-7xl'
              : 'text-4xl text-slate-200 md:text-5xl'
          }`}
        >
          {home ? '¡GOOOOL!' : 'Gol del rival'}
        </p>

        {flash.scorer ? (
          <p className={`text-lg font-semibold ${home ? 'text-slate-100' : 'text-slate-400'}`}>
            {flash.scorer}
          </p>
        ) : (
          <p className="text-sm text-slate-400">En propia puerta</p>
        )}

        {/* Auto-focused on mount for keyboard/AT users, so drop the UA outline and use
            the app's own grass focus ring (as every input does) — and only for keyboard
            (`focus-visible`), so a tap-driven goal shows no ring at all. */}
        <button
          ref={seguirRef}
          type="button"
          onClick={onSeguir}
          className={`mt-2 px-8 outline-none focus-visible:ring-2 focus-visible:ring-grass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-pitch-950 ${
            home ? 'btn-primary' : 'btn-ghost'
          }`}
        >
          Seguir
        </button>
      </div>
    </div>,
    document.body,
  )
}
