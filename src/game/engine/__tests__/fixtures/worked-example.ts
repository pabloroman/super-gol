/**
 * The rulebook's worked example match, as a fixture (docs/rulebook/pages/page-13.md
 * line-ups, page-17.md Figura 1 placement, pages 14–16 play-by-play). PR #16 verified
 * every dice value against the physical booklet, so this is authoritative.
 *
 * Today the harness in worked-example.test.ts replays the CONTESTED_PLAYS through the
 * pure resolution layer (`scoreContest` / keeper save). Once the real 22-piece board
 * engine exists, LINEUPS + INITIAL_PLACEMENT let the *same* data drive a full match
 * replay — the definitive proof that every basic mechanic works.
 *
 * Coordinates mirror the rulebook figure: columns A–E → 0–4, rows 1–6 as printed
 * (row 1 = white's goal line at the top, row 6 = black's). The keeper stands in the
 * portería, outside the 30 cells.
 */

/** Squad line-ups (page 13), indexed so dorsal N is at `[N - 1]`. */
export const LINEUPS = {
  blanco: [
    'ABLANEDO', 'OTERO', 'NACHO', 'TOCORNAL', 'CAMARASA', 'RAFA PAZ',
    'BJELICA', 'MICHEL', 'ESCAICH', 'BARBARÁ', 'FELIPE',
  ],
  negro: [
    'ZUBIZARRETA', 'JAIME', 'LARRAZABAL', 'KARANKA', 'SOLOZÁBAL', 'VIZCAÍNO',
    'FRANCISCO', 'BAKERO', 'KIKO', 'GARITANO', 'MORALES',
  ],
} as const

export interface Placement {
  dorsal: number
  /** Column A–E as 0–4. */
  col: number
  /** Row 1–6 as printed in the figure. */
  row: number
}

/**
 * Figura 1 — initial placement (page 17). White defends the top goal (row 1) and
 * attacks down; black the reverse. The ball starts on white 9 (Escaich) at C3.
 */
export const INITIAL_PLACEMENT: {
  blanco: { keeperDorsal: number; outfield: Placement[] }
  negro: { keeperDorsal: number; outfield: Placement[] }
  ballOn: { side: 'blanco' | 'negro'; dorsal: number }
} = {
  blanco: {
    keeperDorsal: 1,
    outfield: [
      { dorsal: 5, col: 2, row: 1 },
      { dorsal: 2, col: 0, row: 2 },
      { dorsal: 6, col: 1, row: 2 },
      { dorsal: 4, col: 2, row: 2 },
      { dorsal: 8, col: 3, row: 2 },
      { dorsal: 3, col: 4, row: 2 },
      { dorsal: 10, col: 1, row: 3 },
      { dorsal: 9, col: 2, row: 3 },
      { dorsal: 7, col: 3, row: 3 },
      { dorsal: 11, col: 4, row: 3 },
    ],
  },
  negro: {
    keeperDorsal: 1,
    outfield: [
      { dorsal: 11, col: 0, row: 4 },
      { dorsal: 9, col: 2, row: 4 },
      { dorsal: 7, col: 4, row: 4 },
      { dorsal: 3, col: 0, row: 5 },
      { dorsal: 10, col: 1, row: 5 },
      { dorsal: 5, col: 2, row: 5 },
      { dorsal: 6, col: 3, row: 5 },
      { dorsal: 8, col: 4, row: 5 },
      { dorsal: 4, col: 2, row: 6 },
      { dorsal: 2, col: 4, row: 6 },
    ],
  },
  ballOn: { side: 'blanco', dorsal: 9 },
}

/**
 * Every contested (dice-rolled) play from the chronicle (pages 14–16). `dice` holds
 * the raw faces: length 1 ⇒ the single-die `+5` case, length 2 ⇒ two dice. `rating`
 * is the actor's factor. `expected` is the rulebook's own mark — `!` = conseguido,
 * `?` = fallado — where for a keeper save `!` means the shot was stopped.
 *
 * Note the folleto's own errata (page 15/16): the two keepers' names are swapped in
 * the chronicle, so play 30/38's "Ablanedo" is really Zubizarreta and play 53's
 * "Zubizarreta" is really Ablanedo. We keep the printed names; it doesn't affect the
 * dice.
 */
export interface ContestedPlay {
  n: number
  actor: string
  action: string
  dice: number[]
  rating: number
  expected: '!' | '?'
}

export const CONTESTED_PLAYS: ContestedPlay[] = [
  { n: 18, actor: 'Vizcaíno', action: 'RB', dice: [5, 6], rating: 0, expected: '!' },
  { n: 20, actor: 'Solozábal→Francisco', action: 'PL', dice: [2], rating: 1, expected: '?' },
  { n: 27, actor: 'Barbará', action: 'RG', dice: [4, 4], rating: 2, expected: '!' },
  { n: 29, actor: 'Solozábal', action: 'RB', dice: [3, 3], rating: 2, expected: '?' },
  { n: 30, actor: 'Barbará', action: 'DL', dice: [5], rating: 0, expected: '!' },
  { n: 30, actor: 'Ablanedo (save)', action: 'CO', dice: [6, 5], rating: 3, expected: '!' },
  { n: 33, actor: 'Bakero', action: 'PC Hueco', dice: [6, 4], rating: 0, expected: '!' },
  { n: 36, actor: 'Vizcaíno→Francisco', action: 'PL', dice: [4, 5], rating: 1, expected: '!' },
  { n: 36, actor: 'Tocornal', action: 'A', dice: [4, 4], rating: 2, expected: '!' },
  { n: 37, actor: 'Tocornal→Barbará', action: 'PL', dice: [6], rating: 0, expected: '!' },
  { n: 37, actor: 'Solozábal', action: 'A', dice: [1, 2], rating: 2, expected: '?' },
  { n: 38, actor: 'Barbará', action: 'DL', dice: [5, 6], rating: 0, expected: '!' },
  { n: 38, actor: 'Ablanedo (save)', action: 'CO', dice: [5, 4], rating: 3, expected: '!' },
  { n: 39, actor: 'Ablanedo', action: 'PL Hueco', dice: [1, 5], rating: 0, expected: '?' },
  { n: 41, actor: 'Kiko', action: 'RB', dice: [4, 5], rating: 0, expected: '?' },
  { n: 43, actor: 'Michel', action: 'DL', dice: [2], rating: 2, expected: '?' },
  { n: 50, actor: 'Francisco→Kiko', action: 'PC', dice: [2], rating: 3, expected: '!' },
  { n: 50, actor: 'Tocornal', action: 'A', dice: [6, 1], rating: 2, expected: '?' },
  { n: 52, actor: 'Camarasa', action: 'RB', dice: [2, 2], rating: 3, expected: '?' },
  { n: 53, actor: 'Kiko', action: 'RM', dice: [4], rating: 2, expected: '!' },
  { n: 53, actor: 'Zubizarreta (save)', action: 'RF', dice: [4, 3], rating: 2, expected: '?' },
]
