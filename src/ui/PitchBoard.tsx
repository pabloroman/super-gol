import type { Side } from '@/game/engine/types'
import { COLS, ROWS, ZONE_MAP, type Zone } from '@/game/engine/pitch'

/**
 * The real 5×6 board (rulebook page 1), rendered with the away goal at the top and
 * the home goal at the bottom so the human squad attacks upward. Cells are tinted by
 * zone (RM / DL / PA / midfield) and a ball marker sits on the carrier's cell so the
 * crónica can be replayed on the correct grid.
 */

const ZONE_FILL: Record<Zone, string> = {
  RM: 'bg-grass-600/55',
  DL: 'bg-grass-600/30',
  MID: 'bg-grass-500/10',
  PA: 'bg-grass-500/[0.06]',
}

const ZONE_LABEL: Partial<Record<Zone, string>> = {
  RM: 'RM',
  DL: 'DL',
  PA: 'PA',
}

// Goal mouth spans the interior columns (the RM box width: the three central cells).
const GOAL_COLS = [1, 2, 3]

// Display rows top→bottom: away goal (row 4) first, home goal (row 0) last.
const DISPLAY_ROWS = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i)
const ALL_COLS = Array.from({ length: COLS }, (_, i) => i)

function Porteria() {
  return (
    <div className="grid grid-cols-5 gap-0.5 px-0.5">
      {ALL_COLS.map((c) => (
        <div
          key={c}
          className={`h-1.5 rounded-sm ${GOAL_COLS.includes(c) ? 'bg-white/70' : 'bg-transparent'}`}
        />
      ))}
    </div>
  )
}

export function PitchBoard({
  cell,
  side = 'home',
}: {
  cell?: { col: number; row: number } | null
  side?: Side
}) {
  return (
    <div className="rounded-xl bg-pitch-950 p-2 ring-1 ring-white/5">
      <Porteria />
      <div className="relative my-1">
        <div className="grid grid-cols-5 gap-0.5">
          {DISPLAY_ROWS.map((row) =>
            ALL_COLS.map((col) => {
              const zone = ZONE_MAP[row][col]
              const here = cell != null && cell.row === row && cell.col === col
              return (
                <div
                  key={`${row}-${col}`}
                  className={`relative flex aspect-square items-center justify-center rounded-sm ${ZONE_FILL[zone]}`}
                >
                  <span className="select-none text-[8px] font-semibold uppercase tracking-wide text-white/20">
                    {ZONE_LABEL[zone] ?? ''}
                  </span>
                  {here && (
                    <span
                      className={`absolute h-3 w-3 rounded-full shadow ring-2 transition-all duration-300 ${
                        side === 'home'
                          ? 'bg-white ring-grass-400'
                          : 'bg-rare ring-white/50'
                      }`}
                    />
                  )}
                </div>
              )
            }),
          )}
        </div>
        {/* Halfway line across the midfield row. */}
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-white/15" />
        {/* Centre circle. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
      </div>
      <Porteria />
    </div>
  )
}
