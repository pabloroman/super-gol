import type { MatchState, MatchPlayer, Cell } from '@/game/board'
import { dorsal } from '@/game/board'
import { occupants, cellKey, keeperCell, sameCell } from '@/game/board'
import { ZONE_MAP, COLS, ROWS, type Zone } from '@/game/engine/pitch'
import { PlayerFace } from './PlayerFace'

/**
 * The interactive board: the real 5×6 grid plus the two portería cells, with all 22
 * players shown as pips — each the player's own photo under a dorsal badge in the team
 * colour. Away attacks from the top, home from the bottom (so the human plays "up" the
 * screen). Stacking is drawn as two half-height pips — the upper one is "encima" (marking
 * al hombre), which IS the marcaje, so it has to read at a glance.
 *
 * The board is a container: pips are sized in `cqw`, so it fills whatever width it is
 * given (unlike the fixed-px replay board, which caps at 22rem).
 *
 * Every tap — on an empty square OR on any pip — routes through the ONE cell handler
 * `onCell(cell)`; the parent decides select-vs-move from the cell's contents. Pips are
 * therefore visual only: if they swallowed the click (as a nested button would), a move
 * onto an opponent-occupied cell — how you mark a man, page 4 — would be unreachable,
 * since the occupant's pip would eat every tap on its square.
 */

const ZONE_FILL: Record<Zone, string> = {
  RM: 'bg-grass-600/50',
  DL: 'bg-grass-600/25',
  MID: 'bg-grass-500/10',
  PA: 'bg-grass-500/[0.06]',
}

const ALL_COLS = Array.from({ length: COLS }, (_, i) => i)
// Away goal (row 5) at the top, home goal (row 0) at the bottom.
const DISPLAY_ROWS = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i)

function shirtNumber(p: MatchPlayer): string {
  return String(dorsal(p.id))
}

/**
 * The ball is the ⚽ emoji, sized in `cqw` so it scales with the board. It's never amber
 * (that shared the away team's colour) and reads on both the white home pip and the red
 * away pip; a drop shadow lifts it off either. `className` sets the font-size the glyph
 * scales to, plus any positioning.
 */
function Ball({ className }: { className?: string }) {
  return (
    <span aria-hidden className={`leading-none ${className ?? ''}`}>
      ⚽
    </span>
  )
}

/**
 * A ficha: the player's face beside a solid number plate in the team colour — the same two
 * parts however the pip is sized, stacked vertically at full height and side by side at
 * half.
 *
 * The plate is why the colour is a filled block and not a rim: the side has to read at a
 * glance on a board of 22, and a coloured ring around every away ficha would be the same
 * amber the selection ring uses. It also protects the dorsal, which the photo cannot be
 * allowed to cost — the number is the one token the board and the action menu share, so
 * «Pase corto a 9» has to find the 9 on the pitch.
 *
 * A stacked pair is drawn half-height (that offset IS the marcaje), which leaves the face
 * a square to the left of the plate; at full height it gets the portrait box above it.
 */
function Pip({
  player,
  hasBall,
  selected,
  half,
}: {
  player: MatchPlayer
  hasBall: boolean
  selected: boolean
  half: 'top' | 'bottom' | 'full'
}) {
  const home = player.side === 'home'
  const full = half === 'full'
  return (
    // The ball hangs outside the ficha, so it can't sit inside the clipped box that crops
    // the photo — hence the plain wrapper around both.
    <span className={`relative block ${full ? 'h-[16cqw]' : 'h-[8cqw]'} w-[16cqw]`}>
      <span
        className={`flex h-full w-full overflow-hidden rounded-[3cqw] ${full ? 'flex-col' : 'flex-row'} ${
          home ? 'bg-white text-pitch-950' : 'bg-rare text-white'
        } ${selected ? 'z-10 ring-[1.5cqw] ring-amber-300' : 'ring-1 ring-black/30'}`}
      >
        <PlayerFace
          card={player.card}
          objectPosition="center 15%"
          className={`shrink-0 ${full ? 'h-[10cqw] w-full text-[6cqw]' : 'h-full w-[8cqw] text-[4cqw]'}`}
        />
        <span
          className={`flex flex-1 items-center justify-center font-bold leading-none tabular-nums ${
            full ? 'text-[5cqw]' : 'text-[5.5cqw]'
          }`}
        >
          {shirtNumber(player)}
        </span>
      </span>
      {hasBall && (
        <Ball className="absolute -right-[3cqw] -top-[3cqw] text-[9cqw] drop-shadow-[0_0.5cqw_0.5cqw_rgba(0,0,0,0.5)]" />
      )}
    </span>
  )
}

function CellStack({
  players,
  ballCarrier,
  selectedPlayer,
}: {
  players: MatchPlayer[]
  ballCarrier: string | null
  selectedPlayer: string | null
}) {
  if (players.length === 0) return null
  if (players.length === 1) {
    const p = players[0]
    return <Pip player={p} half="full" hasBall={ballCarrier === p.id} selected={selectedPlayer === p.id} />
  }
  // Two players: the one "encima" (onTop) sits in the upper half — that offset IS the marcaje.
  const top = players.find((p) => p.onTop) ?? players[0]
  const bottom = players.find((p) => p.id !== top.id)!
  return (
    <div className="flex flex-col gap-[1cqw]">
      {[top, bottom].map((p, i) => (
        <Pip
          key={p.id}
          player={p}
          half={i === 0 ? 'top' : 'bottom'}
          hasBall={ballCarrier === p.id}
          selected={selectedPlayer === p.id}
        />
      ))}
    </div>
  )
}

export function InteractivePitchBoard({
  state,
  selectedPlayer = null,
  highlight,
  onCell,
}: {
  state: MatchState
  selectedPlayer?: string | null
  highlight?: Set<string>
  /** A tap on a square (empty or occupied); the parent decides select vs move. */
  onCell?: (cell: Cell) => void
}) {
  const ballCarrier = state.ball.carrier
  // The ball is loose (a pase al hueco in flight) → draw it on its cell, since no pip holds it.
  const looseBall = ballCarrier === null ? state.ball.cell : null

  function Porteria({ side }: { side: 'home' | 'away' }) {
    const cell = keeperCell(side)
    const keeper = occupants(state, cell)[0]
    return (
      <div
        role={onCell ? 'button' : undefined}
        onClick={onCell && (() => onCell(cell))}
        className="relative flex h-[16cqw] items-center justify-center"
      >
        <div className="h-[3cqw] w-[40cqw] rounded-full bg-white/40" />
        {keeper && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <Pip
              player={keeper}
              half="full"
              hasBall={ballCarrier === keeper.id}
              selected={selectedPlayer === keeper.id}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-pitch-950 p-[2cqw] ring-1 ring-white/5" style={{ containerType: 'inline-size' }}>
      <div className="relative">
        <Porteria side="away" />
        <div className="grid grid-cols-5 gap-[1cqw]">
          {DISPLAY_ROWS.map((row) =>
            ALL_COLS.map((col) => {
              const cell = { col, row }
              const here = occupants(state, cell)
              const zone = ZONE_MAP[row][col]
              const lit = highlight?.has(cellKey(cell))
              return (
                <div
                  role="button"
                  tabIndex={onCell ? 0 : undefined}
                  key={`${row}-${col}`}
                  onClick={onCell && (() => onCell(cell))}
                  className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-[2cqw] ${ZONE_FILL[zone]} ${
                    lit ? 'ring-[1.5cqw] ring-amber-300/80' : ''
                  }`}
                >
                  <CellStack players={here} ballCarrier={ballCarrier} selectedPlayer={selectedPlayer} />
                  {looseBall && sameCell(cell, looseBall) && (
                    <Ball className="pointer-events-none absolute text-[12cqw] drop-shadow-[0_0.5cqw_0.5cqw_rgba(0,0,0,0.5)]" />
                  )}
                </div>
              )
            }),
          )}
        </div>
        <Porteria side="home" />
      </div>
    </div>
  )
}
