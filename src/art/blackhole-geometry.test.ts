import { describe, expect, it } from 'vitest'
import { BH_ORIGIN_PCT, BH_VIEW, DISK_PATH, INNER_PATH, ellipsePath } from './blackhole-geometry'

describe('geometria del buco nero', () => {
  it('i tracciati sono identici ai letterali storici', () => {
    expect(DISK_PATH).toBe('M589,205 a336,51.5 0 1,0 672,0 a336,51.5 0 1,0 -672,0 Z M757,205 a168,25.8 0 1,0 336,0 a168,25.8 0 1,0 -336,0 Z')
    expect(INNER_PATH).toBe('M706.6,205 a218.4,33.6 0 1,0 436.8,0 a218.4,33.6 0 1,0 -436.8,0 Z M757,205 a168,25.8 0 1,0 336,0 a168,25.8 0 1,0 -336,0 Z')
  })
  it('viewBox e origine in percentuale', () => {
    expect(BH_VIEW).toBe('520 -140 780 900')
    expect(Math.abs(BH_ORIGIN_PCT.x - 0.519)).toBeLessThan(0.001)
    expect(Math.abs(BH_ORIGIN_PCT.y - 0.383)).toBeLessThan(0.001)
  })
  it('ellipsePath stampa la forma decimale più corta', () => {
    expect(ellipsePath(10, 5, 2, 1)).toBe('M8,5 a2,1 0 1,0 4,0 a2,1 0 1,0 -4,0 Z')
  })
})
