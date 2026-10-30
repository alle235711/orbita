// Comete e lune della Copertina: la matematica pura (niente React, niente Dexie,
// niente orologio, niente Math.random). Angoli in gradi, in senso orario sullo
// schermo a partire da +x (l'asse y dell'SVG va verso il basso): 0 destra,
// 90 giù, 180 sinistra, 270 su.

import type { Course, ExamResult } from '../db/schema'
import { addDays, diffDays, isISODate, isMonthOnly, lastDayOfMonth, type ISODate } from '../lib/dates'
import { courseStatus, isGradedPass } from '../libretto/grades'
import { BH, BH_CENTRE, type Point } from './blackhole-geometry'

export type { Point }

const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export function smoothstep(e0: number, e1: number, v: number): number {
  const s = clamp((v - e0) / (e1 - e0), 0, 1)
  return s * s * (3 - 2 * s)
}
const mod = (v: number, m: number) => ((v % m) + m) % m
const polar = (c: Point, r: number, angleDeg: number): Point => ({ x: c.x + r * Math.cos(rad(angleDeg)), y: c.y + r * Math.sin(rad(angleDeg)) })

// --- Impianto -------------------------------------------------------------

export interface CometLayout {
  centre: Point
  /** [da, a] in gradi, da < a: gli angoli delle teste vivono qui. */
  sector: [number, number]
  /** Distanza della testa a 0 giorni (deve stare fuori dalla corsia più esterna delle lune). */
  rMin: number
  /** Distanza a >= horizonDays giorni (e senza giorni). */
  rMax: number
  horizonDays: number
  headRadius: number
  /** Spazio libero minimo tra due teste. */
  gap: number
  /** Lunghezza della coda a 0 giorni. */
  maxTail: number
  tailWindowDays: number
  /** Mezza larghezza della coda alla testa. */
  tailWidth: number
  /** Oltre questo numero le teste con le date più lontane non si disegnano. */
  maxComets: number
}

export interface MoonLayout {
  centre: Point
  tiltDeg: number
  /** b / a di ogni orbita. */
  ratio: number
  /** Semiassi maggiori, dall'interno all'esterno, crescenti. */
  lanes: number[]
  /** [da, a] in gradi del parametro dell'ellisse (0 = estremo +a, 90 = +b, 180 = -a, 270 = -b); a - da <= 300. */
  arc: [number, number]
  minRadius: number
  maxRadius: number
  gap: number
  ringOffset: number
  /** Ampiezza dell'oscillazione lenta lungo l'orbita, in gradi del parametro. */
  swingDeg: number
  maxMoons: number
}

export interface CosmosLayout {
  comets: CometLayout
  moons: MoonLayout
}

// Composizione della copertina (coordinate del buco nero). Le lune formano una
// cintura di corsie concentriche intorno al buco, sul lato sinistro, abbastanza
// vicine da restare libere dal testo (il titolo finisce a x≈600, la frase a 540);
// le comete arrivano da fuori, a destra, nella fascia tra i pulsanti dell'energia
// e l'orbita del giorno, quindi la cattura è sempre una spirale verso l'interno.
// Raggi e corsie sono numeri di questo oggetto: si regolano a occhio, mai nei test.
export const COSMOS_WIDE: CosmosLayout = {
  comets: {
    centre: BH_CENTRE,
    sector: [40, 64],
    rMin: 250,
    rMax: 290,
    horizonDays: 150,
    headRadius: 6,
    gap: 4,
    maxTail: 110,
    tailWidth: 4.5,
    tailWindowDays: 30,
    maxComets: 7,
  },
  moons: {
    centre: BH_CENTRE,
    tiltDeg: BH.tiltDeg,
    ratio: 0.8,
    lanes: [150, 168, 186, 204, 222],
    arc: [130, 215],
    minRadius: 7,
    maxRadius: 11,
    gap: 3,
    ringOffset: 4,
    swingDeg: 4,
    maxMoons: 24,
  },
}

// Telefono: il buco è piccolo in alto a destra e il resto è testo. Le lune
// occupano la striscia a destra del buco, più piccole; le comete la striscia a
// destra della domanda sull'energia.
export const COSMOS_PHONE: CosmosLayout = {
  comets: {
    centre: BH_CENTRE,
    sector: [58, 82],
    rMin: 240,
    rMax: 320,
    horizonDays: 150,
    headRadius: 8,
    gap: 6,
    maxTail: 80,
    tailWidth: 6,
    tailWindowDays: 30,
    maxComets: 5,
  },
  moons: {
    centre: BH_CENTRE,
    tiltDeg: BH.tiltDeg,
    ratio: 1,
    lanes: [130, 145, 160, 175],
    arc: [-24, 50],
    minRadius: 4.5,
    maxRadius: 7.5,
    gap: 2.5,
    ringOffset: 3,
    swingDeg: 4,
    maxMoons: 24,
  },
}

/** Le violazioni dell'impianto; [] se è valido. Serve ai test, non a runtime. */
export function validateLayout(l: CosmosLayout): string[] {
  const out: string[] = []
  const c = l.comets
  const m = l.moons
  if (!(c.sector[0] < c.sector[1])) out.push('sector')
  if (!(c.rMin < c.rMax)) out.push('rMin<rMax')
  if (!m.lanes.length) out.push('lanes empty')
  else {
    if (m.lanes.some((a, i) => i > 0 && !(a > m.lanes[i - 1]!))) out.push('lanes ascending')
    // l'arco di ogni corsia sta fuori dall'anello di fotoni, anche per la luna più grande
    if (!(c.rMin >= Math.max(...m.lanes) + m.maxRadius + m.ringOffset + m.gap)) out.push('rMin clears moons')
    const clear = BH.ring + m.maxRadius + m.ringOffset
    for (const a of m.lanes)
      for (let p = m.arc[0]; p <= m.arc[1]; p += 2) {
        const pt = ellipsePoint(m.centre, m.tiltDeg, a, a * m.ratio, p)
        if (Math.hypot(pt.x - m.centre.x, pt.y - m.centre.y) <= clear) {
          out.push('arc clears ring')
          return out.concat(rest(l))
        }
      }
  }
  return out.concat(rest(l))
}

function rest(l: CosmosLayout): string[] {
  const out: string[] = []
  const c = l.comets
  const m = l.moons
  if (!(m.arc[0] < m.arc[1]) || m.arc[1] - m.arc[0] > 300) out.push('arc')
  if (c.maxComets < 1) out.push('maxComets')
  if (m.maxMoons < 1) out.push('maxMoons')
  if ((c.maxComets - 1) * minCometAngle(c) > c.sector[1] - c.sector[0]) out.push('comet capacity')
  return out
}

// --- Hash -----------------------------------------------------------------

/** FNV-1a a 32 bit sulle unità UTF-16, in [0, 1). */
export function hash01(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) / 4294967296
}

// --- Stati ----------------------------------------------------------------

export type CelestialState =
  | { kind: 'comet'; days: number; date: string; approx: boolean }
  | { kind: 'periodic'; days: number | null; date: string | null; approx: boolean; outcome: 'rifiutato' | 'non-superato'; lastDate: string }
  | { kind: 'moon'; grade: number; lode: boolean; date: string }
  | { kind: 'none'; reason: 'noDate' | 'overdue' | 'idoneita' }

type Target = { days: number; date: string; approx: boolean }

/** Data dell'appello: giorni, data e se è approssimata (solo mese); 'noDate' se inutilizzabile, 'overdue' se già passata. */
export function examTarget(examDate: string | undefined, today: ISODate): Target | 'noDate' | 'overdue' {
  if (typeof examDate !== 'string' || !examDate) return 'noDate'
  if (isISODate(examDate)) {
    if (addDays(examDate, 0) !== examDate) return 'noDate'
    const days = diffDays(today, examDate)
    return days < 0 ? 'overdue' : { days, date: examDate, approx: false }
  }
  if (isMonthOnly(examDate)) {
    if (addDays(`${examDate}-01`, 0) !== `${examDate}-01`) return 'noDate'
    if (lastDayOfMonth(examDate) < today) return 'overdue'
    return { days: Math.max(0, diffDays(today, `${examDate}-15`)), date: examDate, approx: true }
  }
  return 'noDate'
}

export function celestialState(course: Pick<Course, 'id' | 'examDate'>, results: ExamResult[], today: ISODate): CelestialState {
  const status = courseStatus(course.id, results)
  if (status.kind === 'superato') {
    const r = status.result
    if (isGradedPass(r)) return { kind: 'moon', grade: r.grade!, lode: r.lode === true && r.grade === 30, date: r.date }
    return { kind: 'none', reason: 'idoneita' }
  }
  const target = examTarget(course.examDate, today)
  const last = status.attempts[status.attempts.length - 1]
  if (last) {
    const outcome = last.outcome === 'rifiutato' ? 'rifiutato' : 'non-superato'
    const after = typeof target === 'object' && (isMonthOnly(target.date) ? target.date > last.date.slice(0, 7) : target.date > last.date)
    if (typeof target === 'object' && after) return { kind: 'periodic', days: target.days, date: target.date, approx: target.approx, outcome, lastDate: last.date }
    return { kind: 'periodic', days: null, date: null, approx: false, outcome, lastDate: last.date }
  }
  if (target === 'noDate' || target === 'overdue') return { kind: 'none', reason: target }
  return { kind: 'comet', days: target.days, date: target.date, approx: target.approx }
}

// --- Comete ---------------------------------------------------------------

export function cometRadius(days: number | null, l: Pick<CometLayout, 'rMin' | 'rMax' | 'horizonDays'>): number {
  if (days === null || !Number.isFinite(days)) return l.rMax
  return l.rMin + (l.rMax - l.rMin) * clamp(days / l.horizonDays, 0, 1)
}

export function tailLength(days: number | null, l: Pick<CometLayout, 'maxTail' | 'tailWindowDays'>): number {
  if (days === null || !Number.isFinite(days)) return 0
  if (days >= l.tailWindowDays) return 0
  if (days <= 0) return l.maxTail
  return l.maxTail * (1 - days / l.tailWindowDays)
}

/** Angolo minimo in gradi tra due teste alla distanza minima. */
export function minCometAngle(l: Pick<CometLayout, 'rMin' | 'headRadius' | 'gap'>): number {
  const d = 2 * l.headRadius + l.gap
  return deg(2 * Math.asin(Math.min(1, d / (2 * l.rMin))))
}

export interface CometInput {
  id: string
  days: number | null
  periodic?: boolean
}
export interface CometPlacement {
  id: string
  days: number | null
  periodic: boolean
  angle: number
  radius: number
  x: number
  y: number
  tail: number
}

export function layoutComets(inputs: CometInput[], l: CometLayout): CometPlacement[] {
  const seen = new Set<string>()
  let kept = inputs.filter((i) => !seen.has(i.id) && !!seen.add(i.id))
  if (kept.length > l.maxComets) {
    const key = (i: CometInput) => (i.days === null || !Number.isFinite(i.days) ? Infinity : i.days)
    const nearest = new Set(
      [...kept]
        .sort((a, b) => (key(a) === key(b) ? (a.id < b.id ? -1 : 1) : key(a) < key(b) ? -1 : 1))
        .slice(0, l.maxComets)
        .map((i) => i.id),
    )
    kept = kept.filter((i) => nearest.has(i.id))
  }
  const [from, to] = l.sector
  const order = kept.map((i) => ({ id: i.id, a: from + hash01(i.id) * (to - from) })).sort((p, q) => p.a - q.a || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
  const n = order.length
  const g = n > 1 ? Math.min(minCometAngle(l), (to - from) / (n - 1)) : 0
  if (n) order[0]!.a = Math.max(order[0]!.a, from)
  for (let i = 1; i < n; i++) order[i]!.a = Math.max(order[i]!.a, order[i - 1]!.a + g)
  if (n && order[n - 1]!.a > to) {
    order[n - 1]!.a = to
    for (let i = n - 2; i >= 0; i--) order[i]!.a = Math.min(order[i]!.a, order[i + 1]!.a - g)
  }
  const angle = new Map(order.map((o) => [o.id, o.a]))
  return kept.map((i) => {
    const a = angle.get(i.id)!
    const radius = cometRadius(i.days, l)
    const p = polar(l.centre, radius, a)
    return { id: i.id, days: i.days, periodic: !!i.periodic, angle: a, radius, x: p.x, y: p.y, tail: tailLength(i.days, l) }
  })
}

/** Orbita di ritorno tratteggiata di una cometa periodica: dal lato del periastro fino alla testa. */
export function returnOrbit(head: Pick<CometPlacement, 'angle' | 'radius'>, l: Pick<CometLayout, 'centre' | 'rMin'>, o: { points?: number; swingDeg?: number } = {}): Point[] {
  const n = Math.max(1, Math.round(o.points ?? 32))
  const swing = o.swingDeg ?? 55
  const pts: Point[] = []
  for (let i = 0; i <= n; i++) {
    const s = i / n
    pts.push(polar(l.centre, l.rMin + (head.radius - l.rMin) * s ** 1.5, head.angle - swing * (1 - s)))
  }
  pts[n] = polar(l.centre, head.radius, head.angle)
  return pts
}

// --- Lune -----------------------------------------------------------------

export function moonRadius(grade: number, l: Pick<MoonLayout, 'minRadius' | 'maxRadius'>): number {
  const g = Number.isFinite(grade) ? clamp(grade, 18, 30) : 18
  return l.minRadius + ((l.maxRadius - l.minRadius) * (g - 18)) / 12
}

export function ellipsePoint(centre: Point, tiltDeg: number, a: number, b: number, paramDeg: number): Point {
  const u = a * Math.cos(rad(paramDeg))
  const v = b * Math.sin(rad(paramDeg))
  const t = rad(tiltDeg)
  return { x: centre.x + u * Math.cos(t) - v * Math.sin(t), y: centre.y + u * Math.sin(t) + v * Math.cos(t) }
}

export interface MoonInput {
  id: string
  grade: number
  lode: boolean
  date: string
}
export interface MoonPlacement {
  id: string
  grade: number
  lode: boolean
  lane: number
  a: number
  b: number
  phase: number
  x: number
  y: number
  radius: number
  ring: number | null
}

/** Avido e stabile: la posizione di una luna non dipende da quelle venute dopo. */
export function layoutMoons(inputs: MoonInput[], l: MoonLayout): MoonPlacement[] {
  const seen = new Set<string>()
  const sorted = inputs
    .filter((i) => !seen.has(i.id) && !!seen.add(i.id))
    .sort((p, q) => (p.date < q.date ? -1 : p.date > q.date ? 1 : p.id < q.id ? -1 : p.id > q.id ? 1 : 0))
    .slice(-l.maxMoons)
  const [from, to] = l.arc
  const span = to - from
  const lanes = l.lanes.length
  const placed: MoonPlacement[] = []
  sorted.forEach((m, i) => {
    const radius = moonRadius(m.grade, l)
    const ring = m.lode ? radius + l.ringOffset : null
    const extent = ring ?? radius
    for (let tryLane = 0; tryLane < lanes; tryLane++) {
      const lane = (i + tryLane) % lanes
      const a = l.lanes[lane]!
      const b = l.ratio * a
      const p0 = from + hash01(`${m.id}#${lane}`) * span
      for (let k = 0; k <= Math.ceil(span / 2); k++) {
        const phase = from + mod(p0 - from + 2 * k, span)
        const pt = ellipsePoint(l.centre, l.tiltDeg, a, b, phase)
        // mai sull'anello di fotoni, qualunque sia l'impianto
        const clearOfRing = Math.hypot(pt.x - l.centre.x, pt.y - l.centre.y) >= BH.ring + extent
        const free = clearOfRing && placed.every((o) => Math.hypot(pt.x - o.x, pt.y - o.y) >= extent + (o.ring ?? o.radius) + l.gap)
        if (free) {
          placed.push({ id: m.id, grade: m.grade, lode: m.lode, lane, a, b, phase, x: pt.x, y: pt.y, radius, ring })
          return
        }
      }
    }
  })
  return placed
}

const f2 = (x: number) => String(Number(x.toFixed(2)))

/** Arco dell'orbita di una corsia, da disegnare. */
export function orbitArc(centre: Point, tiltDeg: number, a: number, b: number, fromDeg: number, toDeg: number): string {
  const s = ellipsePoint(centre, tiltDeg, a, b, fromDeg)
  const e = ellipsePoint(centre, tiltDeg, a, b, toDeg)
  return `M${f2(s.x)},${f2(s.y)} A${f2(a)},${f2(b)} ${f2(tiltDeg)} ${toDeg - fromDeg > 180 ? 1 : 0},1 ${f2(e.x)},${f2(e.y)}`
}

/** Una polilinea come tracciato SVG. */
export function polylineToPath(pts: Point[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f2(p.x)},${f2(p.y)}`).join(' ')
}

// --- Cattura --------------------------------------------------------------

/** Spirale archimedea verso l'interno: dalla testa della cometa all'orbita della luna. */
export function capturePath(from: Point, to: Point, centre: Point, o: { turns?: number; samples?: number; direction?: 1 | -1 } = {}): Point[] {
  const turns = o.turns ?? 0.5
  const samples = Math.max(2, Math.round(o.samples ?? 48))
  const dir = o.direction ?? 1
  const r0 = Math.hypot(from.x - centre.x, from.y - centre.y)
  const r1 = Math.hypot(to.x - centre.x, to.y - centre.y)
  const th0 = Math.atan2(from.y - centre.y, from.x - centre.x)
  const th1 = Math.atan2(to.y - centre.y, to.x - centre.x)
  const base = mod(dir * (th1 - th0), 2 * Math.PI)
  const total = dir * (base + turns * 2 * Math.PI)
  const pts: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const s = i / samples
    const r = r0 + (r1 - r0) * s
    const th = th0 + total * s
    pts.push({ x: centre.x + r * Math.cos(th), y: centre.y + r * Math.sin(th) })
  }
  pts[0] = { x: from.x, y: from.y }
  pts[samples] = { x: to.x, y: to.y }
  return pts
}

/** Punto a frazione `t` lungo la polilinea (interpolazione lineare sull'indice). */
export function sampleAt(path: Point[], t: number): Point {
  const n = path.length
  if (n === 1) return path[0]!
  const pos = clamp(t, 0, 1) * (n - 1)
  const i = Math.min(n - 2, Math.floor(pos))
  const f = pos - i
  const a = path[i]!
  const b = path[i + 1]!
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}

export interface CaptureSpec {
  startTail: number
  maxTail: number
  headRadius: number
  moonRadius: number
  lode: boolean
  centre: Point
}
export interface CaptureFrame {
  x: number
  y: number
  angle: number
  tail: number
  radius: number
  mix: number
  ringOpacity: number
}

export function captureFrame(path: Point[], t: number, s: CaptureSpec): CaptureFrame {
  const u = clamp(t, 0, 1)
  const p = sampleAt(path, u)
  return {
    x: p.x,
    y: p.y,
    angle: deg(Math.atan2(p.y - s.centre.y, p.x - s.centre.x)),
    tail: u >= 1 ? 0 : (1 - u) * s.startTail + 0.5 * s.maxTail * Math.sin(Math.PI * u),
    radius: s.headRadius + (s.moonRadius - s.headRadius) * smoothstep(0, 1, u),
    mix: smoothstep(0.3, 0.9, u),
    ringOpacity: s.lode ? smoothstep(0.8, 1, u) : 0,
  }
}
