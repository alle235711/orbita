// Il cielo di un universo: dalla valutazione alle forme da disegnare. Pura e
// testata. Coordinate nel viewBox di un cielo (360 x 300). Le distanze dal buco
// nero usano la stessa metafora della copertina (cometRadius di D).

import { cometRadius, clamp, layoutComets, minCometAngle, tailLength, type CometLayout, type Point } from '../art/celestial'
import { BH } from '../art/blackhole-geometry'
import type { Deadline } from '../db/schema'
import { diffDays, weekStart, type ISODate } from '../lib/dates'
import { periodSpans, type UniverseEvaluation } from './scenario'

export interface SkyLayout {
  width: number
  height: number
  centre: Point
  /** Scala del buco nero leggero rispetto al mockup 1180x820. */
  holeScale: number
  comets: CometLayout
  star: { angle: number; radius: number }
  strip: { width: number; height: number; padX: number; padY: number }
  headScale: { min: number; max: number; cfuLow: number; cfuHigh: number }
}

// Numeri da regolare a occhio, mai nei test (validateSkyLayout li tiene coerenti).
export const SKY_LAYOUT: SkyLayout = {
  width: 360,
  height: 330,
  centre: { x: 262, y: 165 },
  holeScale: 0.24,
  comets: {
    centre: { x: 262, y: 165 },
    sector: [125, 235],
    rMin: 66,
    rMax: 185,
    horizonDays: 150,
    headRadius: 4.5,
    gap: 8,
    maxTail: 46,
    tailWidth: 3,
    tailWindowDays: 30,
    maxComets: 8,
  },
  star: { angle: 270, radius: 7 },
  strip: { width: 360, height: 56, padX: 8, padY: 8 },
  headScale: { min: 0.8, max: 1.5, cfuLow: 3, cfuHigh: 15 },
}

const rad = (d: number) => (d * Math.PI) / 180
const f2 = (x: number) => String(Number(x.toFixed(2)))
const SHADOW_MARGIN = 4

/** Le violazioni dell'impianto; [] se è valido. */
export function validateSkyLayout(l: SkyLayout): string[] {
  const out: string[] = []
  const c = l.comets
  const bigHead = c.headRadius * l.headScale.max
  if (!(c.sector[0] < c.sector[1])) out.push('sector')
  if (!(c.rMin < c.rMax)) out.push('rMin<rMax')
  if ((c.maxComets - 1) * minCometAngle(c) > c.sector[1] - c.sector[0]) out.push('comet capacity')
  const far = Math.max(...c.sector.map((a) => Math.abs(Math.sin(rad(a)))))
  if (c.rMax * far + bigHead > l.height / 2) out.push('comets inside vertically')
  if (l.centre.x - c.rMax - bigHead < 0) out.push('comets inside horizontally')
  if (l.star.radius + SHADOW_MARGIN > l.centre.y - c.rMin) out.push('star fits')
  if (c.rMin < BH.shadow * l.holeScale + bigHead + SHADOW_MARGIN) out.push('rMin clears shadow')
  return out
}

// --- Scala comune -----------------------------------------------------------

export interface SharedScale {
  horizonDays: number
  weeks: number
  maxCfu: number
}

export const MIN_HORIZON = 60
export const MAX_HORIZON = 400

export function sharedScale(evals: UniverseEvaluation[], today: ISODate): SharedScale {
  let far = 0
  let maxCfu = 1
  for (const e of evals) {
    const last = e.exams[e.exams.length - 1]
    const end = e.graduationLatest ?? last?.resolved
    if (end) far = Math.max(far, diffDays(today, end))
    if (e.peak) maxCfu = Math.max(maxCfu, e.peak.cfu)
  }
  const horizonDays = clamp(far, MIN_HORIZON, MAX_HORIZON)
  return { horizonDays, weeks: Math.ceil(horizonDays / 7) + 1, maxCfu }
}

// --- Forme ------------------------------------------------------------------

export function headRadiusFor(cfu: number | undefined, l: SkyLayout): number {
  const h = l.headScale
  const t = clamp(((cfu ?? h.cfuLow) - h.cfuLow) / (h.cfuHigh - h.cfuLow), 0, 1)
  return l.comets.headRadius * (h.min + (h.max - h.min) * t)
}

/** Arco che si gonfia verso l'esterno tra due teste. */
export function warnArcPath(a: Point, b: Point, centre: Point): string {
  const mx = (a.x + b.x) / 2
  const my = (a.y + b.y) / 2
  let nx = mx - centre.x
  let ny = my - centre.y
  const len = Math.hypot(nx, ny)
  if (len < 1e-9) {
    nx = Math.cos(rad(270))
    ny = Math.sin(rad(270))
  } else {
    nx /= len
    ny /= len
  }
  const bulge = clamp(0.35 * Math.hypot(a.x - b.x, a.y - b.y), 10, 40)
  return `M ${f2(a.x)},${f2(a.y)} Q ${f2(mx + nx * bulge)},${f2(my + ny * bulge)} ${f2(b.x)},${f2(b.y)}`
}

/** Stella a cinque punte, prima punta in alto. */
export function starPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = rad(-90 + i * 36)
    pts.push(`${f2(cx + rr * Math.cos(a))},${f2(cy + rr * Math.sin(a))}`)
  }
  return pts.join(' ')
}

export interface Segment {
  x1: number
  y1: number
  x2: number
  y2: number
}
export interface SkyComet {
  courseId: string
  name: string
  x: number
  y: number
  angle: number
  tail: number
  headR: number
  monthOnly: boolean
  range: Segment | null
  close: boolean
  period: 'certain' | 'uncertain' | null
}
export interface SkyArc {
  a: string
  b: string
  d: string
  uncertain: boolean
}
export interface SkyBand {
  periodId: string
  name: string
  rInner: number
  rOuter: number
  conflict: boolean
}
export interface SkyStar {
  x: number
  y: number
  r: number
  provisional: boolean
  range: Segment | null
  points: string
}
export interface SkyStrip {
  curve: string
  area: string
  peak: Point | null
  exams: { courseId: string; x: number }[]
  bands: { periodId: string; x: number; w: number; conflict: boolean }[]
  star: { x: number } | null
}
export interface UniverseSky {
  comets: SkyComet[]
  arcs: SkyArc[]
  bands: SkyBand[]
  star: SkyStar | null
  strip: SkyStrip
  hidden: number
}

const MIN_BAND = 2

function polar(c: Point, r: number, angleDeg: number): Point {
  return { x: c.x + r * Math.cos(rad(angleDeg)), y: c.y + r * Math.sin(rad(angleDeg)) }
}

function smoothPath(pts: Point[]): string {
  if (!pts.length) return ''
  const p = (q: Point) => `${f2(q.x)},${f2(q.y)}`
  if (pts.length === 1) return `M ${p(pts[0]!)}`
  let d = `M ${p(pts[0]!)} Q ${p(pts[0]!)} ${p(mid(pts[0]!, pts[1]!))}`
  for (let i = 1; i < pts.length - 1; i++) d += ` Q ${p(pts[i]!)} ${p(mid(pts[i]!, pts[i + 1]!))}`
  return `${d} L ${p(pts[pts.length - 1]!)}`
}
const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function buildSky(input: { evaluation: UniverseEvaluation; periods: Deadline[]; allExamIds: string[]; today: ISODate; scale: SharedScale; layout: SkyLayout }): UniverseSky {
  const { evaluation: ev, periods, allExamIds, today, scale, layout } = input
  const cl: CometLayout = { ...layout.comets, horizonDays: scale.horizonDays }
  const byId = new Map(ev.exams.map((e) => [e.courseId, e]))

  // 1. Comete: gli angoli dipendono da tutti gli esami della pagina, la distanza da questo universo.
  const placed = layoutComets(
    allExamIds.map((id) => ({ id, days: byId.get(id)?.days ?? null })),
    cl,
  ).filter((p) => byId.has(p.id))
  const closeIds = new Set(ev.tooClose.flatMap((p) => [p.a, p.b]))
  const radiusAt = (d: ISODate) => cometRadius(Math.max(0, diffDays(today, d)), cl)
  const comets: SkyComet[] = placed.map((p) => {
    const e = byId.get(p.id)!
    const conflicts = ev.periodConflicts.filter((c) => c.courseId === p.id)
    const a = radiusAt(e.lo)
    const b = radiusAt(e.hi)
    const s = polar(cl.centre, a, p.angle)
    const t = polar(cl.centre, b, p.angle)
    return {
      courseId: p.id,
      name: e.name,
      x: p.x,
      y: p.y,
      angle: p.angle,
      tail: tailLength(p.days, cl),
      headR: headRadiusFor(e.cfu, layout),
      monthOnly: e.monthOnly,
      range: e.monthOnly ? { x1: s.x, y1: s.y, x2: t.x, y2: t.y } : null,
      close: closeIds.has(p.id),
      period: conflicts.some((c) => !c.uncertain) ? 'certain' : conflicts.length ? 'uncertain' : null,
    }
  })
  const head = new Map(comets.map((c) => [c.courseId, c]))

  // 2. Archi tra le teste troppo vicine.
  const arcs: SkyArc[] = []
  for (const pair of ev.tooClose) {
    const a = head.get(pair.a)
    const b = head.get(pair.b)
    if (a && b) arcs.push({ a: pair.a, b: pair.b, d: warnArcPath(a, b, cl.centre), uncertain: pair.uncertain })
  }

  // 3. Fasce dei periodi speciali (tempo = raggio).
  const spans = periodSpans(periods).filter((s) => s.end >= today && diffDays(today, s.start) <= scale.horizonDays)
  const bands: SkyBand[] = spans.map((s) => {
    const rInner = radiusAt(s.start)
    const rOuter = Math.max(radiusAt(s.end), rInner + MIN_BAND)
    return { periodId: s.id, name: s.name, rInner, rOuter, conflict: ev.periodConflicts.some((c) => c.periodId === s.id) }
  })

  // 4. Stella della laurea, dritta in alto: il raggio usa lo spazio sopra il buco.
  let star: SkyStar | null = null
  if (ev.graduationDate) {
    const rTop = layout.centre.y - layout.star.radius - SHADOW_MARGIN
    const radiusStar = (d: ISODate) => cl.rMin + (rTop - cl.rMin) * clamp(diffDays(today, d) / scale.horizonDays, 0, 1)
    const at = polar(layout.centre, radiusStar(ev.graduationDate), layout.star.angle)
    let range: Segment | null = null
    if (ev.graduationUncertain && ev.graduationEarliest && ev.graduationLatest) {
      const s = polar(layout.centre, radiusStar(ev.graduationEarliest), layout.star.angle)
      const t = polar(layout.centre, radiusStar(ev.graduationLatest), layout.star.angle)
      range = { x1: s.x, y1: s.y, x2: t.x, y2: t.y }
    }
    star = { x: at.x, y: at.y, r: layout.star.radius, provisional: !ev.complete, range, points: starPoints(at.x, at.y, layout.star.radius) }
  }

  // 5. Striscia del carico settimanale.
  const { width, height, padX, padY } = layout.strip
  const spanX = width - 2 * padX
  const weeks = Math.max(2, scale.weeks)
  const baseline = height - padY
  const yOf = (cfu: number) => baseline - (cfu / scale.maxCfu) * (height - 2 * padY)
  const monday = weekStart(today)
  const dayX = (date: ISODate) => clamp(padX + (diffDays(monday, date) / (7 * (weeks - 1))) * spanX, padX, width - padX)
  const pts = ev.weeklyLoad.map((w, i) => ({ x: padX + (Math.min(i, weeks - 1) / (weeks - 1)) * spanX, y: yOf(w.cfu) }))
  const curve = smoothPath(pts)
  const last = pts[pts.length - 1]
  const first = pts[0]
  const area = last && first ? `${curve} L ${f2(last.x)},${f2(baseline)} L ${f2(first.x)},${f2(baseline)} Z` : ''
  const peakIndex = ev.peak ? ev.weeklyLoad.findIndex((w) => w.week === ev.peak!.week) : -1
  const strip: SkyStrip = {
    curve,
    area,
    peak: peakIndex >= 0 ? pts[peakIndex]! : null,
    exams: ev.exams.map((e) => ({ courseId: e.courseId, x: dayX(e.resolved) })),
    bands: spans.map((s) => {
      const x1 = dayX(s.start)
      const x2 = dayX(s.end)
      return { periodId: s.id, x: x1, w: Math.max(MIN_BAND, x2 - x1), conflict: ev.periodConflicts.some((c) => c.periodId === s.id) }
    }),
    star: ev.graduationDate ? { x: dayX(ev.graduationDate) } : null,
  }

  return { comets, arcs, bands, star, strip, hidden: Math.max(0, ev.exams.length - comets.length) }
}
