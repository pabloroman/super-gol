import { describe, it, expect } from 'vitest'
import {
  COLS,
  ROWS,
  ZONE_MAP,
  zoneAt,
  laneFor,
  initialPitch,
  pitchAt,
} from '@/game/engine/pitch'

describe('ZONE_MAP', () => {
  it('is a 6×5 board', () => {
    expect(ZONE_MAP).toHaveLength(ROWS)
    for (const row of ZONE_MAP) expect(row).toHaveLength(COLS)
  })

  it('is symmetric top-to-bottom (an RM/DL box at each goal)', () => {
    for (let r = 0; r < ROWS; r++) {
      expect(ZONE_MAP[r]).toEqual(ZONE_MAP[ROWS - 1 - r])
    }
  })

  it('puts the box (RM) at each goal line and PA on both wings', () => {
    // Interior of the goal rows is the box.
    for (const col of [1, 2, 3, 4]) {
      expect(zoneAt({ col, row: 0 })).toBe('RM')
      expect(zoneAt({ col, row: ROWS - 1 })).toBe('RM')
    }
    // Full wings are PA (pases altos).
    for (let row = 0; row < ROWS; row++) {
      expect(zoneAt({ col: 0, row })).toBe('PA')
      expect(zoneAt({ col: COLS - 1, row })).toBe('PA')
    }
    // Midfield centre is build-up.
    expect(zoneAt({ col: 2, row: 2 })).toBe('MID')
  })
})

describe('Pitch advancement', () => {
  it('starts each possession at midfield, where no shot is legal', () => {
    const p = initialPitch('home')
    expect(p.zone).toBe('MID')
    expect(p.canShootRM()).toBe(false)
    expect(p.canShootDL()).toBe(false)
    expect(p.toGoal()).toBe(2)
  })

  it('home advances up the rows: MID → DL (long shot) → RM (box)', () => {
    const mid = initialPitch('home')
    const dl = mid.step(1)
    expect(dl.cell.row).toBe(3)
    expect(dl.zone).toBe('DL')
    expect(dl.canShootDL()).toBe(true)
    expect(dl.canShootRM()).toBe(false)
    expect(dl.toGoal()).toBe(1)

    const rm = dl.step(1)
    expect(rm.cell.row).toBe(ROWS - 1)
    expect(rm.zone).toBe('RM')
    expect(rm.canShootRM()).toBe(true)
    expect(rm.toGoal()).toBe(0)
  })

  it('away advances down the rows toward row 0', () => {
    const mid = initialPitch('away')
    expect(mid.cell.row).toBe(2)
    const dl = mid.step(1)
    expect(dl.cell.row).toBe(1)
    expect(dl.canShootDL()).toBe(true)
    const rm = dl.step(1)
    expect(rm.cell.row).toBe(0)
    expect(rm.canShootRM()).toBe(true)
    expect(rm.toGoal()).toBe(0)
  })

  it('clamps at the goal line and never leaves the board', () => {
    const rm = initialPitch('home').step(1).step(1)
    expect(rm.step(1).cell.row).toBe(ROWS - 1)
    const own = initialPitch('home').step(-1).step(-1).step(-1)
    expect(own.cell.row).toBe(0)
  })

  it('toLane keeps the carrier in an interior lane and its zone', () => {
    const rm = pitchAt({ col: 4, row: ROWS - 1 }, 'home')
    const shifted = rm.toLane(1)
    expect(shifted.cell.col).toBe(1)
    expect(shifted.zone).toBe('RM')
    expect(shifted.canShootRM()).toBe(true)
  })
})

describe('laneFor', () => {
  it('always maps to an interior lane (cols 1–4), never a wing', () => {
    for (let i = 0; i < 20; i++) {
      const col = laneFor(i)
      expect(col).toBeGreaterThanOrEqual(1)
      expect(col).toBeLessThanOrEqual(4)
    }
  })
})
