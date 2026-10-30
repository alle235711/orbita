import { describe, expect, it } from 'vitest'
import type { ExamResult } from '../db/schema'
import {
  COSMOS_PHONE,
  COSMOS_WIDE,
  capturePath,
  captureFrame,
  celestialState,
  cometRadius,
  ellipsePoint,
  hash01,
  layoutComets,
  layoutMoons,
  minCometAngle,
  moonRadius,
  orbitArc,
  returnOrbit,
  sampleAt,
  tailLength,
  validateLayout,
} from './celestial'
import { BH_CENTRE } from './blackhole-geometry'

const close = (a: number, b: number, d = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(d)
const L = { rMin: 500, rMax: 700, horizonDays: 100 }
const TODAY = '2026-10-28'
const res = (id: string, courseId: string, date: string, outcome: ExamResult['outcome'], extra: Partial<ExamResult> = {}): ExamResult => ({ id, courseId, date, outcome, updatedAt: 1, ...extra })

describe('hash01', () => {
  it('è deterministico e in [0, 1)', () => {
    expect(hash01('abc')).toBe(hash01('abc'))
    expect(hash01('abc')).not.toBe(hash01('abd'))
    for (const s of ['', 'a', 'sdm', 'Analisi Fittizia #1']) {
      expect(hash01(s)).toBeGreaterThanOrEqual(0)
      expect(hash01(s)).toBeLessThan(1)
    }
    // FNV-1a di "" è l'offset basis
    close(hash01(''), 0x811c9dc5 / 4294967296)
  })
})

describe('formule delle comete', () => {
  it('cometRadius', () => {
    expect(cometRadius(0, L)).toBe(500)
    expect(cometRadius(50, L)).toBe(600)
    expect(cometRadius(100, L)).toBe(700)
    expect(cometRadius(1000, L)).toBe(700)
    expect(cometRadius(-5, L)).toBe(500)
    expect(cometRadius(null, L)).toBe(700)
    expect(cometRadius(NaN, L)).toBe(700)
  })
  it('tailLength', () => {
    const T = { maxTail: 120, tailWindowDays: 30 }
    expect(tailLength(30, T)).toBe(0)
    expect(tailLength(45, T)).toBe(0)
    expect(tailLength(15, T)).toBe(60)
    expect(tailLength(0, T)).toBe(120)
    expect(tailLength(-3, T)).toBe(120)
    expect(tailLength(null, T)).toBe(0)
    expect(tailLength(NaN, T)).toBe(0)
  })
  it('minCometAngle: corda di 2*r*sin(a/2) = 2*head + gap', () => {
    const l = { rMin: 500, headRadius: 7, gap: 6 }
    const a = minCometAngle(l)
    close(2 * 500 * Math.sin((a * Math.PI) / 360), 20, 1e-9)
  })
})

describe('layoutComets', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `corso-${i}`)
  const L = COSMOS_WIDE.comets

  it.each([1, 2, 5, 7])('%i comete: nel settore e mai più vicine di 2*testa+gap', (n) => {
    const out = layoutComets(ids.slice(0, n).map((id, i) => ({ id, days: i * 10 })), L)
    expect(out).toHaveLength(n)
    for (const p of out) {
      expect(p.angle).toBeGreaterThanOrEqual(L.sector[0] - 1e-9)
      expect(p.angle).toBeLessThanOrEqual(L.sector[1] + 1e-9)
    }
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) expect(Math.hypot(out[i]!.x - out[j]!.x, out[i]!.y - out[j]!.y)).toBeGreaterThanOrEqual(2 * L.headRadius + L.gap - 1e-6)
  })
  it('gli angoli non dipendono dai giorni né dall’ordine', () => {
    const a = layoutComets(ids.slice(0, 6).map((id) => ({ id, days: 3 })), L)
    const b = layoutComets(ids.slice(0, 6).map((id, i) => ({ id, days: 100 + i })).reverse(), L)
    for (const p of a) close(p.angle, b.find((q) => q.id === p.id)!.angle, 1e-12)
  })
  it('l’ordine dell’ingresso si conserva e i doppioni cadono', () => {
    const out = layoutComets([{ id: 'b', days: 1 }, { id: 'a', days: 2 }, { id: 'b', days: 9 }], L)
    expect(out.map((p) => p.id)).toEqual(['b', 'a'])
    expect(out[0]!.days).toBe(1)
  })
  it('oltre maxComets restano le più vicine', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `x${i}`, days: 15 - i }))
    const out = layoutComets(many, L)
    expect(out).toHaveLength(L.maxComets)
    expect(out.map((p) => p.id)).not.toContain('x0')
    expect(out.map((p) => p.id)).toContain('x14')
  })
  it('raggio e coda seguono i giorni', () => {
    const [p] = layoutComets([{ id: 'u', days: 0 }], L)
    expect(p!.radius).toBe(L.rMin)
    expect(p!.tail).toBe(L.maxTail)
    close(Math.hypot(p!.x - L.centre.x, p!.y - L.centre.y), L.rMin, 1e-9)
  })
  it('cambiare i giorni muove solo il raggio', () => {
    const a = layoutComets([{ id: 'u', days: 10 }, { id: 'v', days: 20 }], L)
    const b = layoutComets([{ id: 'u', days: 90 }, { id: 'v', days: 20 }], L)
    close(a[0]!.angle, b[0]!.angle, 1e-12)
    expect(a[0]!.radius).not.toBe(b[0]!.radius)
  })
})

describe('returnOrbit', () => {
  it('parte da rMin, finisce esattamente sulla testa', () => {
    const head = { angle: 170, radius: 650 }
    const pts = returnOrbit(head, { centre: BH_CENTRE, rMin: 500 })
    expect(pts).toHaveLength(33)
    close(Math.hypot(pts[0]!.x - BH_CENTRE.x, pts[0]!.y - BH_CENTRE.y), 500, 1e-9)
    close(pts[32]!.x, BH_CENTRE.x + 650 * Math.cos((170 * Math.PI) / 180), 1e-9)
    expect(returnOrbit(head, { centre: BH_CENTRE, rMin: 500 }, { points: 4 })).toHaveLength(5)
  })
})

describe('lune', () => {
  it('moonRadius', () => {
    const M = { minRadius: 9, maxRadius: 17 }
    expect(moonRadius(18, M)).toBe(9)
    expect(moonRadius(30, M)).toBe(17)
    expect(moonRadius(24, M)).toBe(13)
    expect(moonRadius(10, M)).toBe(9)
    expect(moonRadius(99, M)).toBe(17)
    expect(moonRadius(NaN, M)).toBe(9)
  })
  it('ellipsePoint senza inclinazione e con inclinazione', () => {
    const c = { x: 100, y: 50 }
    const p0 = ellipsePoint(c, 0, 10, 4, 0)
    close(p0.x, 110)
    close(p0.y, 50)
    const p1 = ellipsePoint(c, 0, 10, 4, 90)
    close(p1.x, 100)
    close(p1.y, 54)
    const p2 = ellipsePoint(c, 90, 10, 4, 0)
    close(p2.x, 100)
    close(p2.y, 60)
  })
  it.each([1, 3, 8, 24])('%i lune: sull’ellisse e senza sovrapposizioni', (n) => {
    const l = COSMOS_WIDE.moons
    const inputs = Array.from({ length: n }, (_, i) => ({ id: `m${i}`, grade: 18 + (i % 13), lode: i % 5 === 0, date: `2026-0${1 + (i % 9)}-1${i % 10}` }))
    const out = layoutMoons(inputs, l)
    expect(out.length).toBeGreaterThan(0)
    expect(out.length).toBe(n)
    for (const m of out) {
      // riporta il punto nel riferimento dell'orbita e verifica (u/a)^2 + (v/b)^2 = 1
      const t = (l.tiltDeg * Math.PI) / 180
      const dx = m.x - l.centre.x
      const dy = m.y - l.centre.y
      const u = dx * Math.cos(t) + dy * Math.sin(t)
      const v = -dx * Math.sin(t) + dy * Math.cos(t)
      close((u / m.a) ** 2 + (v / m.b) ** 2, 1, 1e-9)
      expect(m.phase).toBeGreaterThanOrEqual(l.arc[0])
      expect(m.phase).toBeLessThanOrEqual(l.arc[1])
      expect(m.ring === null).toBe(!m.lode)
    }
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]!
        const b = out[j]!
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual((a.ring ?? a.radius) + (b.ring ?? b.radius) + l.gap - 1e-6)
      }
  })
  it('è stabile: le prime non dipendono dalle successive; oltre maxMoons restano le più recenti', () => {
    const l = COSMOS_PHONE.moons
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, grade: 20, lode: false, date: `2026-01-${String(i + 1).padStart(2, '0')}` }))
    const few = layoutMoons(mk(4), l)
    const more = layoutMoons(mk(6), l)
    for (const m of few) expect(more.find((q) => q.id === m.id)).toEqual(m)
    const lots = layoutMoons(Array.from({ length: 30 }, (_, i) => ({ id: `n${i}`, grade: 20, lode: false, date: `2026-02-${String(i + 1).padStart(2, '0')}` })), l)
    expect(lots.length).toBeLessThanOrEqual(l.maxMoons)
    expect(lots.map((m) => m.id)).not.toContain('n0')
  })
  it('orbitArc', () => {
    expect(orbitArc({ x: 0, y: 0 }, 0, 100, 30, 0, 180)).toBe('M100,0 A100,30 0 0,1 -100,0')
    expect(orbitArc({ x: 0, y: 0 }, 0, 100, 30, 0, 270)).toBe('M100,0 A100,30 0 1,1 0,-30')
  })
})

describe('capienza reale delle lune', () => {
  const mixed = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `lun${i}`, grade: 18 + ((i * 5) % 13), lode: i % 6 === 0, date: `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}` }))
  it.each([
    ['wide', COSMOS_WIDE],
    ['phone', COSMOS_PHONE],
  ])('%s: 24 lune di voti diversi, con lode, entrano tutte', (_n, layout) => {
    const out = layoutMoons(mixed(24), layout.moons)
    expect(out).toHaveLength(24)
  })
  it.each([
    ['wide', COSMOS_WIDE],
    ['phone', COSMOS_PHONE],
  ])('%s: nessuna luna sull’anello di fotoni, nemmeno su un impianto qualsiasi', (_n, layout) => {
    for (const l of [layout.moons, { ...layout.moons, lanes: [60, 100, 140], ratio: 0.5, arc: [0, 360 - 61] as [number, number] }])
      for (const m of layoutMoons(mixed(24), l)) expect(Math.hypot(m.x - l.centre.x, m.y - l.centre.y)).toBeGreaterThanOrEqual(116.5 + (m.ring ?? m.radius) - 1e-9)
  })
  it('una cattura sale sempre verso l’interno: le comete stanno fuori dalle lune', () => {
    for (const l of [COSMOS_WIDE, COSMOS_PHONE]) {
      const far = Math.max(...layoutMoons(mixed(24), l.moons).map((m) => Math.hypot(m.x - l.moons.centre.x, m.y - l.moons.centre.y) + (m.ring ?? m.radius)))
      expect(l.comets.rMin).toBeGreaterThan(far)
    }
  })
})

describe('cattura', () => {
  const c = { x: 0, y: 0 }
  it('capturePath: estremi esatti, raggio che scende', () => {
    const from = { x: 600, y: 100 }
    const to = { x: -200, y: 80 }
    const p = capturePath(from, to, c)
    expect(p).toHaveLength(49)
    expect(p[0]).toEqual(from)
    expect(p[48]).toEqual(to)
    for (let i = 1; i < p.length; i++) expect(Math.hypot(p[i]!.x, p[i]!.y)).toBeLessThan(Math.hypot(p[i - 1]!.x, p[i - 1]!.y) + 1e-9)
    expect(capturePath(from, to, c, { samples: 0 })).toHaveLength(3)
    // stesso raggio: costante
    const q = capturePath({ x: 100, y: 0 }, { x: 0, y: 100 }, c, { samples: 10 })
    for (const pt of q.slice(1, -1)) close(Math.hypot(pt.x, pt.y), 100, 1e-9)
  })
  it('sampleAt interpola e satura', () => {
    const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]
    expect(sampleAt(path, 0.25)).toEqual({ x: 5, y: 0 })
    expect(sampleAt(path, 0.75)).toEqual({ x: 10, y: 5 })
    expect(sampleAt(path, -1)).toEqual(path[0])
    expect(sampleAt(path, 5)).toEqual(path[2])
  })
  it('captureFrame a t=0 e t=1', () => {
    const path = capturePath({ x: 600, y: 0 }, { x: 0, y: 300 }, c)
    const spec = { startTail: 80, maxTail: 140, headRadius: 7, moonRadius: 17, lode: true, centre: c }
    const f0 = captureFrame(path, 0, spec)
    expect(f0).toMatchObject({ x: 600, y: 0, tail: 80, radius: 7, mix: 0, ringOpacity: 0 })
    close(f0.angle, 0)
    const f1 = captureFrame(path, 1, spec)
    expect(f1.tail).toBe(0)
    expect(f1).toMatchObject({ x: 0, y: 300, radius: 17, mix: 1, ringOpacity: 1 })
    close(f1.angle, 90)
    expect(captureFrame(path, 1, { ...spec, lode: false }).ringOpacity).toBe(0)
    expect(captureFrame(path, 7, spec)).toEqual(f1)
  })
})

describe('celestialState', () => {
  const course = (examDate?: string) => ({ id: 'c', examDate })
  it('cometa con data completa, mese, nessuna data, scaduto', () => {
    expect(celestialState(course('2026-11-17'), [], TODAY)).toEqual({ kind: 'comet', days: 20, date: '2026-11-17', approx: false })
    expect(celestialState(course('2026-10-28'), [], TODAY)).toMatchObject({ kind: 'comet', days: 0 })
    expect(celestialState(course('2026-10-27'), [], TODAY)).toEqual({ kind: 'none', reason: 'overdue' })
    expect(celestialState(course('2026-11'), [], TODAY)).toEqual({ kind: 'comet', days: 18, date: '2026-11', approx: true })
    expect(celestialState(course('2026-10'), [], TODAY)).toMatchObject({ kind: 'comet', days: 0, approx: true })
    expect(celestialState(course('2026-09'), [], TODAY)).toEqual({ kind: 'none', reason: 'overdue' })
    for (const bad of [undefined, '', 'boh', '2026-02-30', '2026-13', '2026-1']) expect(celestialState(course(bad), [], TODAY)).toEqual({ kind: 'none', reason: 'noDate' })
  })
  it('luna: voto, lode solo con 30, idoneità senza voto', () => {
    expect(celestialState(course(), [res('r', 'c', '2026-09-01', 'superato', { grade: 27 })], TODAY)).toEqual({ kind: 'moon', grade: 27, lode: false, date: '2026-09-01' })
    expect(celestialState(course(), [res('r', 'c', '2026-09-01', 'superato', { grade: 30, lode: true })], TODAY)).toMatchObject({ lode: true })
    expect(celestialState(course(), [res('r', 'c', '2026-09-01', 'superato', { grade: 28, lode: true })], TODAY)).toMatchObject({ lode: false })
    expect(celestialState(course(), [res('r', 'c', '2026-09-01', 'superato')], TODAY)).toEqual({ kind: 'none', reason: 'idoneita' })
  })
  it('periodica: tentativo respinto e prossimo appello', () => {
    const r = [res('r', 'c', '2026-10-10', 'rifiutato')]
    expect(celestialState(course('2026-12-05'), r, TODAY)).toEqual({ kind: 'periodic', days: 38, date: '2026-12-05', approx: false, outcome: 'rifiutato', lastDate: '2026-10-10' })
    expect(celestialState(course('2026-12'), r, TODAY)).toMatchObject({ kind: 'periodic', date: '2026-12', approx: true })
    // data non dopo il tentativo, scaduta o assente: periodica senza data
    for (const d of ['2026-10-10', '2026-10-05', '2026-10', undefined, '2026-10-20'])
      expect(celestialState(course(d), r, TODAY)).toMatchObject({ kind: 'periodic', days: null, date: null, approx: false })
    expect(celestialState(course('2026-11-02'), [res('r', 'c', '2026-10-10', 'non-superato')], TODAY)).toMatchObject({ outcome: 'non-superato', days: 5 })
  })
  it('l’ultimo risultato decide', () => {
    const r = [res('a', 'c', '2026-09-01', 'superato', { grade: 20 }), res('b', 'c', '2026-10-01', 'rifiutato')]
    expect(celestialState(course('2026-12-01'), r, TODAY).kind).toBe('periodic')
    const r2 = [res('a', 'c', '2026-09-01', 'rifiutato'), res('b', 'c', '2026-10-01', 'superato', { grade: 22 })]
    expect(celestialState(course('2026-12-01'), r2, TODAY).kind).toBe('moon')
    expect(celestialState(course('2026-12-01'), [res('x', 'other', '2026-10-01', 'superato', { grade: 22 })], TODAY).kind).toBe('comet')
  })
})

describe('validateLayout', () => {
  it('gli impianti predefiniti sono validi', () => {
    expect(validateLayout(COSMOS_WIDE)).toEqual([])
    expect(validateLayout(COSMOS_PHONE)).toEqual([])
  })
  it('segnala le violazioni', () => {
    const bad = { comets: { ...COSMOS_WIDE.comets, maxComets: 40 }, moons: { ...COSMOS_WIDE.moons, lanes: [500, 400] } }
    const v = validateLayout(bad)
    expect(v).toContain('comet capacity')
    expect(validateLayout({ ...COSMOS_WIDE, comets: { ...COSMOS_WIDE.comets, rMin: 200 } })).toContain('rMin clears moons')
    expect(v).toContain('lanes ascending')
    expect(validateLayout({ ...COSMOS_WIDE, moons: { ...COSMOS_WIDE.moons, lanes: [100] } })).toContain('arc clears ring')
    expect(validateLayout({ ...COSMOS_WIDE, moons: { ...COSMOS_WIDE.moons, lanes: [] } })).toContain('lanes empty')
  })
})
