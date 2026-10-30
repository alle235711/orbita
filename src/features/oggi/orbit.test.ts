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
        { id: 'a', minutes: 9 * 60, label: 'Cosmologia Osservativa', time: '9:00', kind: 'event' },
        { id: 'b', minutes: 11 * 60, label: 'Topologia Generale', time: '11:00', kind: 'event' },
        { id: 'c', minutes: 18.5 * 60, label: 'Arrampicata', time: '18:30', kind: 'event' },
      ],
      MOCKUP,
      1180,
    )
    expect(placed[0]!.labelY).toBeLessThan(placed[0]!.y)
    expect(placed[2]!.anchor).toBe('end')
  })

  // Il piano dimostrativo, in ogni ora del giorno e con le due mappe (largo e telefono):
  // nessuna etichetta tocca un'altra, e nemmeno "adesso" (stima dalle stesse misure della funzione).
  it('"adesso" e le etichette non si sovrappongono a nessuna ora', () => {
    const events = [
      { id: 'e1', minutes: 9 * 60, label: 'Cosmologia Osservativa', time: '9:00', kind: 'event' as const },
      { id: 'e2', minutes: 11 * 60, label: 'Topologia Generale', time: '11:00', kind: 'event' as const },
      { id: 'e3', minutes: 12.5 * 60, label: 'Pausa pranzo', time: '12:30', kind: 'suggestion' as const },
      { id: 'e4', minutes: 14.5 * 60, label: 'Fisica Moderna', time: '14:30', kind: 'event' as const },
      { id: 'e5', minutes: 16.5 * 60, label: 'Arrampicata', time: '16:30', kind: 'suggestion' as const },
      { id: 'e6', minutes: 18.5 * 60, label: 'Calcolo Numerico', time: '18:30', kind: 'event' as const },
    ]
    const layouts = [
      { mapping: { sx: 1, sy: 1, y0: 90 }, width: 1180, font: 13 },
      { mapping: { sx: 390 / 1180, sy: Math.min(1, (390 / 1180) * 2.3), y0: 300 }, width: 390, font: 12 },
    ]
    for (const { mapping, width, font } of layouts)
      for (let now = 8 * 60; now <= 19 * 60; now += 10) {
        const list = [...events, { id: 'adesso', minutes: now, label: 'adesso', time: '', kind: 'now' as const }]
        const placed = placePlanets(list, mapping, width, font * 0.53, font)
        const boxes = placed.map((p) => {
          const text = p.kind === 'now' ? p.label : `${p.time} ${p.label}`
          const w = text.length * font * 0.53
          const x1 = p.anchor === 'start' ? p.labelX : p.labelX - w
          return { id: p.id, x1, x2: x1 + w, y1: p.labelY - font, y2: p.labelY + 2 }
        })
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!
            const b = boxes[j]!
            const hit = a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1
            expect(hit, `${a.id} / ${b.id} alle ${now / 60} (${width}px)`).toBe(false)
          }
      }
  })
})
