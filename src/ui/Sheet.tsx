import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Bottom sheet. The app's first real overlay primitive — the only prior one is
 * inline in Admin.tsx with no portal, focus trap or Escape handling, so it was
 * not a base to build on.
 *
 * Portals to <body> so the sheet escapes the app shell's `max-w-md` column and
 * any ancestor stacking context.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  /** Accessible name for the dialog; rendered as the sheet's heading. */
  title: string
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // Escape to close, Tab cycles within the panel.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null)
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // Lock the page behind the sheet, and hand focus back to the opener on close.
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(firstFocusable ?? panelRef.current)?.focus()

    return () => {
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex max-h-[88vh] w-full max-w-md flex-col gap-3 rounded-t-2xl bg-pitch-800 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 ring-1 ring-white/10 outline-none"
      >
        <div className="mx-auto h-1 w-8 shrink-0 rounded-full bg-white/20" aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
