import { describe, it, expect } from 'vitest'
import { COLS, ROWS, ZONE_MAP, zoneAt } from '@/game/engine/pitch'

describe('ZONE_MAP', () => {
  it('is a 5×6 board', () => {
    expect(ZONE_MAP).toHaveLength(ROWS)
    for (const row of ZONE_MAP) expect(row).toHaveLength(COLS)
    expect(COLS).toBe(5)
    expect(ROWS).toBe(6)
  })

  it('is symmetric top-to-bottom (an RM/DL box at each goal)', () => {
    for (let r = 0; r < ROWS; r++) {
      expect(ZONE_MAP[r]).toEqual(ZONE_MAP[ROWS - 1 - r])
    }
  })

  it('puts three RM cells at each goal line and PA on the end-row wings', () => {
    // The box is the three central cells (page 10: "las tres casillas RM").
    for (const col of [1, 2, 3]) {
      expect(zoneAt({ col, row: 0 })).toBe('RM')
      expect(zoneAt({ col, row: ROWS - 1 })).toBe('RM')
    }
    // Three DL cells in the ring just outside the box.
    for (const col of [1, 2, 3]) {
      expect(zoneAt({ col, row: 1 })).toBe('DL')
      expect(zoneAt({ col, row: ROWS - 2 })).toBe('DL')
    }
    // Wings of the RM/DL rows are PA (pases altos).
    for (const row of [0, 1, ROWS - 2, ROWS - 1]) {
      expect(zoneAt({ col: 0, row })).toBe('PA')
      expect(zoneAt({ col: COLS - 1, row })).toBe('PA')
    }
    // The two centre rows are unlabelled build-up, wings included.
    for (const col of [0, 2, COLS - 1]) {
      expect(zoneAt({ col, row: 2 })).toBe('MID')
      expect(zoneAt({ col, row: 3 })).toBe('MID')
    }
  })
})
