import { describe, it, expect } from 'vitest'
import type { Rng } from '@/game/engine/rng'
import type { EngineCard } from '@/game/engine/types'
import { LINEUPS, INITIAL_PLACEMENT } from '@/game/engine/__tests__/fixtures/worked-example'
import { apply, marcajeOf, playerId, type MatchState, type MatchPlayer, type Action, type Cell } from '@/game/board'
import { keeperCell } from '@/game/board'

/**
 * The definitive Phase 2 test: replay the rulebook's worked example (docs/rulebook/
 * pages 13–17) through `apply`, one Action per play, and assert the engine reproduces
 * the booklet's dice counts, successes, possession changes and board figures — all 53
 * plays, from Escaich's kickoff to Kiko's goal.
 *
 * The dice COUNT of each contested play is a pure function of the marcaje, which the
 * engine derives from the board — so matching every count across the example proves the
 * stacking geometry is correct at every contested moment, not just the arithmetic. And
 * because a wrong count desynchronises the fixed dice stream, the very next contest
 * fails too: the replay is self-checking.
 *
 * Board checkpoints assert the full stacking against Figura 2 (after play 18) and
 * Figura 4 (after play 36) — the two the rulebook itself calls "cuadra al 100 %".
 * Figura 3 and Figura 5 carry documented drawing erratas (see page-17.md), so they are
 * covered by the play-by-play rather than a whole-board compare.
 *
 * Coordinates: the figures print rows 1–6 with blanco on top; this model uses rows 0–5
 * with home defending row 0, so printed row r → r-1, blanco → home, negro → away.
 *
 * Three chronicle slips are corrected here, not transcribed (all pre-documented):
 *   - play 38 rolls two dice in print though the shooter is libre → one die (pages 8–9);
 *   - play 43's "5 + D2: 2" is a D1 typo → one die;
 *   - plays 15–16 swap the keepers' names, which the engine ignores (it picks the
 *     defending keeper by side, and the ratings are attached to the right cards).
 */

// Ratings the contested plays exercise (all other factors are 0, rulebook page 6).
const RATINGS: Record<string, EngineCard['abilities']> = {
  BARBARÁ: { rg: 2 },
  TOCORNAL: { a: 2 },
  CAMARASA: { rb: 3 },
  MICHEL: { dl: 2 },
  ABLANEDO: { rf: 2 }, // blanco keeper (saves Kiko's RM at play 53)
  VIZCAÍNO: { pl: 1 },
  SOLOZÁBAL: { rb: 2, a: 2, pl: 1 },
  FRANCISCO: { pc: 3 },
  KIKO: { rm: 2 },
  ZUBIZARRETA: { co: 3 }, // negro keeper (saves Barbará's DL at plays 30/38)
}

const idByName: Record<string, string> = {}
for (const [side, fside] of [['home', 'blanco'], ['away', 'negro']] as const) {
  LINEUPS[fside].forEach((name, i) => (idByName[name] = playerId(side, i)))
}
const P = (name: string) => idByName[name]

/** Printed cell like C('B', 4) → { col: 1, row: 3 }. */
const COLS = 'ABCDE'
const C = (letter: string, printedRow: number): Cell => ({ col: COLS.indexOf(letter), row: printedRow - 1 })

function buildState(): MatchState {
  const players: Record<string, MatchPlayer> = {}
  for (const [side, fside] of [['home', 'blanco'], ['away', 'negro']] as const) {
    const lineup = LINEUPS[fside]
    const place = INITIAL_PLACEMENT[fside]
    const card = (i: number): EngineCard => ({
      id: `${fside}-${lineup[i]}`,
      name: lineup[i],
      position: i === place.keeperDorsal - 1 ? 'GK' : 'MF',
      abilities: RATINGS[lineup[i]] ?? {},
    })
    const kIdx = place.keeperDorsal - 1
    players[playerId(side, kIdx)] = { id: playerId(side, kIdx), side, card: card(kIdx), cell: keeperCell(side), onTop: false }
    for (const { dorsal, col, row } of place.outfield) {
      const id = playerId(side, dorsal - 1)
      players[id] = { id, side, card: card(dorsal - 1), cell: { col, row: row - 1 }, onTop: false }
    }
  }
  const escaich = P('ESCAICH')
  return {
    version: 1,
    players,
    ball: { carrier: escaich, cell: { ...players[escaich].cell } },
    attacker: 'home',
    phase: { kind: 'kickoff', side: 'home' },
    libre: null,
    score: { home: 0, away: 0 },
    turno: 0,
    ply: 0,
    possessionJugadas: 0,
    antiStall: { pdChain: [], movedTo: {} },
    difficulty: 'competitive',
  }
}

/** An Rng handing out fixed faces while counting how many it dispensed. */
function countingRng(faces: number[]): { rng: Rng; draws: () => number } {
  let i = 0
  const rng: Rng = {
    d6: () => faces[i++],
    next: () => 0.5,
    int: () => 0,
    pick: <T>(xs: readonly T[]): T => xs[0],
    chance: () => false,
  }
  return { rng, draws: () => i }
}

/** Dorsal label for a player id, home plain, away parenthesised — the figures' notation. */
function dorsalOf(id: string): string {
  const n = parseInt(id.slice(1), 10) + 1
  return id[0] === 'h' ? `${n}` : `(${n})`
}

/**
 * Render the 5×6 board the way page 17 prints it (printed row 1 = model row 0 at the
 * top), each cell its occupants top-first joined by "/", empties as ".". The ball marker
 * is deliberately omitted so a checkpoint compares POSITIONS and stacking only.
 */
function render(state: MatchState): string {
  const rows: string[] = []
  for (let r = 0; r < 6; r++) {
    const cells = [0, 1, 2, 3, 4].map((c) => {
      const occ = Object.values(state.players).filter((p) => p.cell.col === c && p.cell.row === r)
      if (occ.length === 0) return '.'
      occ.sort((a, b) => (a.onTop === b.onTop ? 0 : a.onTop ? -1 : 1))
      return occ.map((p) => dorsalOf(p.id)).join('/')
    })
    rows.push(cells.join(' '))
  }
  return rows.join('\n')
}

/** Trim the leading indentation off a figure literal so it lines up with `render`. */
const fig = (s: string): string =>
  s.trim().split('\n').map((l) => l.trim()).join('\n')

// Figura 2 — start of TURNO 2, after play 18 (Vizcaíno has just robbed at D5).
const FIGURA_2 = fig(`
  . . 5 . .
  2 6 4 (7) 11
  (11) 10 . 7 3
  . (10) (9) . .
  . (3)/9 (5) (6)/8 (8)
  . . (4) . (2)
`)

// Figura 4 — TURNO 5, after play 36 (Tocornal has anticipated and holds the ball at D2).
const FIGURA_4 = fig(`
  . . 5 . .
  2 . . 4/(7) 11
  (11) 6/(9) . 7 3
  . (10) . (6) .
  . (3)/9 10/(5) 8 (8)
  . . (4) . (2)
`)

interface Step {
  n: number
  a: Action
  /** Faces for a contested play (its length is the dice count the engine must draw). */
  dice?: number[]
  /** Assertions to run after this step. */
  check?: (st: MatchState) => void
  note?: string
}

/**
 * All 53 plays (TURNOS 1–8), from pages 14–16. A "play" in the chronicle can be several
 * Actions — a completed pass then the defender's interruption, a failed robo then the
 * attacker's advance — so those carry the same `n`. Movements carry the printed
 * destination; contested plays carry their dice faces (shot Steps append the keeper's
 * two save dice); automatic plays carry none.
 */
const SCRIPT: Step[] = [
  // TURNO 1 — blanco builds up, negro shadows, Vizcaíno robs.
  { n: 1, a: { kind: 'pass', pass: 'PD', to: P('BJELICA') } },
  { n: 2, a: { kind: 'pass', pass: 'PD', to: P('MICHEL') } },
  { n: 3, a: { kind: 'pass', pass: 'PD', to: P('CAMARASA') } },
  { n: 4, a: { kind: 'move', player: P('NACHO'), to: C('E', 3) } }, // relevo with Felipe
  { n: 5, a: { kind: 'move', player: P('MORALES'), to: C('A', 3) } },
  { n: 6, a: { kind: 'move', player: P('ESCAICH'), to: C('B', 4) } },
  { n: 7, a: { kind: 'move', player: P('GARITANO'), to: C('B', 4) } }, // M.H. Escaich
  { n: 8, a: { kind: 'move', player: P('ESCAICH'), to: C('B', 5) } },
  { n: 9, a: { kind: 'move', player: P('LARRAZABAL'), to: C('B', 5) } }, // M.H. Escaich
  { n: 10, a: { kind: 'move', player: P('MICHEL'), to: C('C', 3) } },
  { n: 11, a: { kind: 'move', player: P('FRANCISCO'), to: C('D', 3) } }, // M.H. Bjelica
  { n: 12, a: { kind: 'move', player: P('MICHEL'), to: C('D', 4) } },
  { n: 13, a: { kind: 'move', player: P('FRANCISCO'), to: C('D', 2) } },
  { n: 14, a: { kind: 'pass', pass: 'PD', to: P('TOCORNAL') } },
  { n: 15, a: { kind: 'pass', pass: 'PD', to: P('BJELICA') } },
  { n: 16, a: { kind: 'pass', pass: 'PD', to: P('MICHEL') } },
  { n: 17, a: { kind: 'move', player: P('MICHEL'), to: C('D', 5) } }, // with ball onto Vizcaíno
  {
    n: 18,
    a: { kind: 'robo', defender: P('VIZCAÍNO'), mode: 'move-onto', to: C('D', 5) },
    dice: [5, 6],
    check: (st) => {
      expect(st.ball.carrier).toBe(P('VIZCAÍNO'))
      expect(st.attacker).toBe('away')
      expect(st.turno).toBe(1)
      expect(marcajeOf(st, P('MICHEL'))).toBe('MH')
      expect(render(st)).toBe(FIGURA_2)
    },
  },
  // TURNO 2 — negro attacks, blanco recovers a failed long ball.
  { n: 19, a: { kind: 'pass', pass: 'PD', to: P('SOLOZÁBAL') } },
  {
    n: 20,
    a: { kind: 'pass', pass: 'PL', to: P('FRANCISCO') },
    dice: [2],
    check: (st) => {
      // Failed PL → the rulebook's recovery names Camarasa; the engine must agree.
      expect(st.ball.carrier).toBe(P('CAMARASA'))
      expect(st.attacker).toBe('home')
      expect(st.turno).toBe(2)
    },
  },
  // TURNO 3 — blanco works Barbará free with a regate, then Barbará shoots.
  { n: 21, a: { kind: 'pass', pass: 'PD', to: P('RAFA PAZ') } },
  { n: 22, a: { kind: 'pass', pass: 'PD', to: P('BARBARÁ') } },
  { n: 23, a: { kind: 'move', player: P('BARBARÁ'), to: C('C', 4) } }, // with ball onto Kiko
  { n: 24, a: { kind: 'move', player: P('KIKO'), to: C('B', 3) } }, // LE DEJA SOLO
  { n: 25, a: { kind: 'move', player: P('RAFA PAZ'), to: C('B', 3) } }, // M.H. Kiko
  { n: 26, a: { kind: 'move', player: P('SOLOZÁBAL'), to: C('C', 4) } }, // M.H. Barbará
  {
    n: 27,
    a: { kind: 'regate' },
    dice: [4, 4], // Barbará is marked al hombre → two dice
    check: (st) => {
      expect(st.ball.carrier).toBe(P('BARBARÁ'))
      expect(st.libre).toBe(P('BARBARÁ')) // regate success → libre next jugada
    },
  },
  { n: 28, a: { kind: 'move', player: P('BARBARÁ'), to: C('C', 5) } }, // libre carrier moves
  { n: 29, a: { kind: 'robo', defender: P('SOLOZÁBAL'), mode: 'move-onto', to: C('C', 5) }, dice: [3, 3] },
  { n: 29, a: { kind: 'decline_advance' } }, // Barbará elige no mover
  {
    n: 30,
    a: { kind: 'shot', shot: 'DL' }, // Barbará libre → one die; Zubizarreta saves (two)
    dice: [5, 6, 5],
    check: (st) => {
      expect(st.score).toEqual({ home: 0, away: 0 })
      expect(st.attacker).toBe('away') // possession to negro after the save
      expect(st.turno).toBe(3)
    },
  },
  // TURNO 4 — Zubizarreta restarts; a PC al hueco Vizcaíno collects; Tocornal anticipates.
  { n: 31, a: { kind: 'premove_done' } },
  { n: 31, a: { kind: 'premove_done' } },
  { n: 31, a: { kind: 'keeper_pass', pass: 'PD', to: P('JAIME') } }, // PD a dos casillas
  { n: 32, a: { kind: 'pass', pass: 'PD', to: P('BAKERO') } },
  { n: 33, a: { kind: 'hueco', pass: 'PC', to: C('D', 4) }, dice: [6, 4] }, // PC hueco !
  { n: 34, a: { kind: 'move', player: P('VIZCAÍNO'), to: C('D', 4) } }, // coge el balón
  { n: 35, a: { kind: 'move', player: P('TOCORNAL'), to: C('D', 2) } }, // M.H. Francisco
  { n: 36, a: { kind: 'pass', pass: 'PL', to: P('FRANCISCO') }, dice: [4, 5] }, // to a marked man
  {
    n: 36,
    a: { kind: 'anticipacion', defender: P('TOCORNAL') }, // al-hombre marker anticipates (page 8)
    dice: [4, 4],
    check: (st) => {
      expect(st.ball.carrier).toBe(P('TOCORNAL'))
      expect(st.attacker).toBe('home')
      expect(st.turno).toBe(4)
      expect(render(st)).toBe(FIGURA_4)
    },
  },
  // TURNO 5 — blanco attacks; Solozábal's anticipación fails; Barbará shoots again.
  { n: 37, a: { kind: 'pass', pass: 'PL', to: P('BARBARÁ') }, dice: [6] }, // both zonal → one die
  { n: 37, a: { kind: 'anticipacion', defender: P('SOLOZÁBAL') }, dice: [1, 2] }, // fails
  {
    n: 38,
    a: { kind: 'shot', shot: 'DL' }, // libre → one die (print shows two — corrected); save two
    dice: [5, 5, 4],
    check: (st) => {
      expect(st.score).toEqual({ home: 0, away: 0 })
      expect(st.attacker).toBe('away')
      expect(st.turno).toBe(5)
    },
  },
  // TURNO 6 — Zubizarreta's PL al hueco fails; Bjelica collects for blanco.
  { n: 39, a: { kind: 'premove_done' } },
  { n: 39, a: { kind: 'premove_done' } },
  { n: 39, a: { kind: 'keeper_hueco', pass: 'PL', to: C('C', 3) }, dice: [1, 5] }, // PL hueco ?
  {
    n: 40,
    a: { kind: 'move', player: P('BJELICA'), to: C('C', 3) }, // coge el balón → blanco
    check: (st) => {
      expect(st.ball.carrier).toBe(P('BJELICA'))
      expect(st.attacker).toBe('home')
      expect(st.turno).toBe(6)
    },
  },
  // TURNO 7 — Kiko's robo fails, Bjelica advances and Michel shoots wide.
  { n: 41, a: { kind: 'robo', defender: P('KIKO'), mode: 'move-onto', to: C('C', 3) }, dice: [4, 5] }, // fails
  { n: 41, a: { kind: 'robo_advance', to: C('C', 4) } }, // Bjelica elige ir a C4
  { n: 42, a: { kind: 'pass', pass: 'PD', to: P('MICHEL') } },
  {
    n: 43,
    a: { kind: 'shot', shot: 'DL' }, // Michel alone → one die (print's second die is a D1 typo)
    dice: [2],
    check: (st) => {
      expect(st.attacker).toBe('away')
      expect(st.turno).toBe(7)
    },
  },
  // TURNO 8 — negro works it to Kiko and scores.
  { n: 44, a: { kind: 'premove_done' } },
  { n: 44, a: { kind: 'premove_done' } },
  { n: 44, a: { kind: 'keeper_pass', pass: 'PD', to: P('JAIME') } }, // PD a dos casillas
  { n: 45, a: { kind: 'pass', pass: 'PD', to: P('BAKERO') } },
  { n: 46, a: { kind: 'pass', pass: 'PD', to: P('VIZCAÍNO') } },
  { n: 47, a: { kind: 'pass', pass: 'PD', to: P('KIKO') } },
  {
    n: 48,
    a: { kind: 'move', player: P('KIKO'), to: C('D', 2), handoff: true }, // relevo con balón
    check: (st) => {
      // Kiko and Francisco swap; the ball is LEFT with Francisco (the hand-off).
      expect(st.ball.carrier).toBe(P('FRANCISCO'))
      expect(st.players[P('FRANCISCO')].cell).toEqual(C('C', 3))
      expect(st.players[P('KIKO')].cell).toEqual(C('D', 2))
    },
  },
  { n: 49, a: { kind: 'move', player: P('RAFA PAZ'), to: C('C', 2) } }, // blanco defends
  { n: 50, a: { kind: 'pass', pass: 'PC', to: P('KIKO') }, dice: [2] }, // PC ! to a marked man
  { n: 50, a: { kind: 'anticipacion', defender: P('TOCORNAL') }, dice: [6, 1] }, // fails
  { n: 51, a: { kind: 'move', player: P('KIKO'), to: C('D', 1) } }, // libre carrier moves
  { n: 52, a: { kind: 'robo', defender: P('CAMARASA'), mode: 'move-onto', to: C('D', 1) }, dice: [2, 2] }, // fails
  { n: 52, a: { kind: 'robo_advance', to: C('C', 1) } }, // Kiko elige ir a C1
  {
    n: 53,
    a: { kind: 'shot', shot: 'RM' }, // Kiko libre → one die; Ablanedo fails the save → GOL
    dice: [4, 4, 3],
    check: (st) => {
      expect(st.score).toEqual({ home: 0, away: 1 })
      expect(st.turno).toBe(8)
    },
  },
]

describe('rulebook worked example — full 22-piece board replay (plays 1–53)', () => {
  it('reproduces every dice count, result, possession change and board figure', () => {
    let st = buildState()
    for (const step of SCRIPT) {
      const { rng, draws } = countingRng(step.dice ?? [])
      const before = st
      st = apply(st, step.a, rng).state

      if (step.dice) {
        expect(draws(), `play ${step.n} should roll ${step.dice.length} dice`).toBe(step.dice.length)
      } else {
        expect(draws(), `play ${step.n} is automatic and must roll no dice`).toBe(0)
      }

      step.check?.(st)
      // Guard against silent no-ops.
      expect(st, `play ${step.n} must change the state`).not.toBe(before)
    }

    // The example ends 0–1 to negro (Kiko's goal), after eight possession changes.
    expect(st.score).toEqual({ home: 0, away: 1 })
    expect(st.turno).toBe(8)
  })
})
