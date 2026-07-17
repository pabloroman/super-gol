import { describe, it, expect } from 'vitest'
import type { Rng } from '@/game/engine/rng'
import type { EngineCard } from '@/game/engine/types'
import { LINEUPS, INITIAL_PLACEMENT } from '@/game/engine/__tests__/fixtures/worked-example'
import { apply, marcajeOf, playerId, type MatchState, type MatchPlayer, type Action, type Cell } from '@/game/board'
import { keeperCell } from '@/game/board'

/**
 * The definitive Phase 2 test: replay the rulebook's worked example (docs/rulebook/
 * pages 13–17) through `apply`, one Action per play, and assert the engine reproduces
 * the booklet's dice counts, successes, possession changes and board checkpoints.
 *
 * The dice COUNT of each contested play is a pure function of the marcaje, which the
 * engine derives from the board — so matching every count across the example proves the
 * stacking geometry is correct at every contested moment, not just the arithmetic.
 *
 * Coordinates: the figures print rows 1–6 with blanco on top; this model uses rows 0–5
 * with home defending row 0, so printed row r → r-1, blanco → home, negro → away.
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
    difficulty: 'normal',
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

interface Step {
  n: number
  a: Action
  /** Faces for a contested play (its length is the dice count the engine must draw). */
  dice?: number[]
  /** Whether the contest succeeds ('!' in the chronicle). */
  ok?: boolean
}

// Plays 1–20 (TURNOS 1–2), transcribed from page 14. Movements carry the printed
// destination; passes carry the target; contested plays carry their dice + result.
//
// TODO(resume): extend to plays 21–53 (TURNOS 3–8). Play 27's regate currently rejects
// because plays 23–26 don't leave Barbará marked — a divergence to debug next: either a
// transcription error here or a marcaje bug in the carrier-move-with-ball / plain
// move-onto-the-holder path. Remaining mechanics to cover: regate on the board,
// anticipación (36/37/50), keeper restart (31/44), pase corto al hueco (33), relevo con
// balón with hand-off (48), cesión, and Kiko's closing goal (53).
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
  { n: 18, a: { kind: 'robo', defender: P('VIZCAÍNO'), mode: 'move-onto', to: C('D', 5) }, dice: [5, 6], ok: true },
  // TURNO 2 — negro attacks, blanco recovers a failed long ball.
  { n: 19, a: { kind: 'pass', pass: 'PD', to: P('SOLOZÁBAL') } },
  { n: 20, a: { kind: 'pass', pass: 'PL', to: P('FRANCISCO') }, dice: [2], ok: false },
]

describe('rulebook worked example — full board replay (plays 1–20)', () => {
  it('reproduces every dice count, result, possession change and key checkpoint', () => {
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

      // Checkpoints tied to specific plays.
      if (step.n === 18) {
        // Vizcaíno robbed the ball: possession flips to negro, Vizcaíno on top of Michel.
        expect(st.ball.carrier).toBe(P('VIZCAÍNO'))
        expect(st.attacker).toBe('away')
        expect(st.turno).toBe(1)
        expect(marcajeOf(st, P('MICHEL'))).toBe('MH')
      }
      if (step.n === 20) {
        // Failed PL → the rulebook's recovery names Camarasa; the engine must agree.
        expect(st.ball.carrier).toBe(P('CAMARASA'))
        expect(st.attacker).toBe('home')
        expect(st.turno).toBe(2)
      }
      // Guard against silent no-ops.
      expect(st).not.toBe(before)
    }

    // Through TURNO 2: two possession changes (play 18 robo, play 20 recovery), still 0–0.
    expect(st.score).toEqual({ home: 0, away: 0 })
    expect(st.turno).toBe(2)
  })
})
