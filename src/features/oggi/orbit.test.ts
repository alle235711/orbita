import { describe, expect, it } from 'vitest'
import { angleAt, ellipsePoint, placePlanets, timePoint, travelledPath } from './orbit'

const MOCKUP = { sx: 1, sy: 1, y0: 0 }
const near = (a: { x: number; y: number }, b: [number, number], tol = 3) =>
  Math.abs(a.x - b[0]) <= tol && Math.abs(a.y - b[1]) <= tol

describe('orbita del giorno', () => {
  it('ritrova i pianeti del mockup alle loro ore', () => {
    expect(near(timePoint(8 * 60, MOCKUP), [248, 479])).toBe(true)
    expect(near(timePoint(9 * 60, MOCKUP), [298, 508])).toBe(true)
    expect(near(timePoint(11 * 60, MOCKUP), [449, 540])).toBe(true)
    expect(near(timePoint(14.5 * 60, MOCKUP), [798, 502])).toBe(true)
    expect(near(timePoint(16.5 * 60, MOCKUP), [987, 434])).toBe(true)
    expect(near(timePoint(18.5 * 60, MOCKUP), [1125, 346])).toBe(true)
    expect(near(timePoint(19 * 60, MOCKUP), [1149, 323])).toBe(true)
  })

  it('tiene gli orari fuori dalla giornata agli estremi', () => {
    expect(angleAt(6 * 60)).toBe(angleAt(8 * 60))
    expect(angleAt(23 * 60)).toBe(angleAt(19 * 60))
  })

  it('scala in pixel e trasla', () => {
    const p = timePoint(8 * 60, { sx: 0.5, sy: 2, y0: 300 })
    expect(p.x).toBeCloseTo(124, 0)
    expect(p.y).toBeCloseTo(358, 0)
    expect(ellipsePoint(0).x).toBeGreaterThan(1180 - 300)
  })

  it('l’arco percorso esiste solo dopo le 8', () => {
    expect(travelledPath(7 * 60, MOCKUP)).toBeNull()
    expect(travelledPath(15 * 60, MOCKUP)).toMatch(/^M24[78]\.\d,479/)
  })

  it('alterna le etichette e le gira a sinistra vicino al bordo', () => {
    const placed = placePlanets(
      [
        { id: 'a', minutes: 9 * 60, label: 'Astrofisica Stellare', time: '9:00', kind: 'event' },
        { id: 'b', minutes: 11 * 60, label: 'Topologia Algebrica', time: '11:00', kind: 'event' },
        { id: 'c', minutes: 18.5 * 60, label: 'Arrampicata', time: '18:30', kind: 'event' },
      ],
      MOCKUP,
      1180,
    )
    expect(placed[0]!.labelY).toBeLessThan(placed[0]!.y)
    expect(placed[2]!.anchor).toBe('end')
  })
})
