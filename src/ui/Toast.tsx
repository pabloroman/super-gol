import { createPortal } from 'react-dom'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/solid'

/**
 * A non-modal, transient confirmation that floats above the page — the counterpart
 * to `Sheet` (the only *modal* overlay). Unlike Sheet it deliberately has no
 * backdrop, no focus trap and no scroll lock: it must not block the page behind it,
 * so a `pointer-events-none` wrapper lets clicks pass through everywhere except the
 * panel itself. Don't grow this into a second modal — reach for `Sheet` for that.
 *
 * Portals to <body> to escape any ancestor stacking context, and sits at z-30:
 * above the BottomNav (z-20) so it clears the phone tab bar, below the Sheet modal
 * (z-40) so a dialog always wins.
 *
 * Presentational and stateless — the caller owns `open` and decides when it closes
 * (there is no auto-dismiss timer; it persists until dismissed or the caller
 * unmounts, e.g. on navigation).
 */
export function Toast({
  open,
  onClose,
  message,
  action,
}: {
  open: boolean
  onClose: () => void
  message: string
  /** Optional call-to-action rendered as a primary button. */
  action?: { label: string; onClick: () => void }
}) {
  if (!open) return null

  return createPortal(
    // The wrapper spans the width but ignores pointer events; only the panel is
    // interactive, so the page stays fully usable behind the toast.
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 flex justify-center px-4 md:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div className="toast-in pointer-events-auto flex w-full max-w-md flex-col gap-3 rounded-2xl bg-pitch-800 p-4 shadow-2xl shadow-black/60 ring-1 ring-white/10 md:max-w-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-grass-400">
            <CheckIcon className="h-5 w-5 shrink-0" aria-hidden />
            {message}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 shrink-0 rounded-lg px-2 py-1 text-slate-400 transition hover:bg-white/5 hover:text-slate-100"
          >
            <XMarkIcon className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {action && (
          <button
            type="button"
            className="btn-primary w-full"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
