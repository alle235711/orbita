// Geometria dell'orbita del giorno. Nel mockup l'arco del giorno è un tratto
// dell'ellisse d'orbita (centro 700,320, semiassi 500 e 200, ruotata di −12°)
// che va da 162,1° alle 8:00 a 28,8° alle 19:00, con l'angolo lineare nell'ora.

export const ORBIT = { cx: 700, cy: 320, rx: 500, ry: 200, rotation: -12 } as const
export const DAY_START = 8 * 60
export const DAY_END = 19 * 60
const THETA_START = 162.1
const THETA_END = 28.8

export interface Mapping {
  /** Da coordinate del mockup (1180 di larghezza) a pixel. */
  sx: number
  sy: number
  /** Riga del mockup che finisce in y = 0. */
  y0: number
}

export interface Point {
  x: number
  y: number
}

const rad = (deg: number) => (deg * Math.PI) / 180

/** Punto dell'ellisse all'angolo `deg`, in coordinate del mockup. */
export function ellipsePoint(deg: number): Point {
  const t = rad(deg)
  const phi = rad(ORBIT.rotation)
  const x = ORBIT.rx * Math.cos(t)
  const y = ORBIT.ry * Math.sin(t)
  return { x: ORBIT.cx + x * Math.cos(phi) - y * Math.sin(phi), y: ORBIT.cy + x * Math.sin(phi) + y * Math.cos(phi) }
}

export function angleAt(minutes: number): number {
  const f = (Math.min(DAY_END, Math.max(DAY_START, minutes)) - DAY_START) / (DAY_END - DAY_START)
  return THETA_START + (THETA_END - THETA_START) * f
}

export function project(p: Point, m: Mapping): Point {
  return { x: p.x * m.sx, y: (p.y - m.y0) * m.sy }
}

export function timePoint(minutes: number, m: Mapping): Point {
  return project(ellipsePoint(angleAt(minutes)), m)
}

/** Polilinea dell'arco tra due orari (o dell'ellisse intera). */
export function arcPath(fromDeg: number, toDeg: number, m: Mapping, steps = 64): string {
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const p = project(ellipsePoint(fromDeg + ((toDeg - fromDeg) * i) / steps), m)
    pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
}

export function dayArcPath(m: Mapping): string {
  return arcPath(THETA_START, THETA_END, m)
}

export function travelledPath(now: number, m: Mapping): string | null {
  if (now <= DAY_START) return null
  return arcPath(THETA_START, angleAt(now), m, 48)
}

export function fullOrbitPath(m: Mapping): string {
  return `${arcPath(0, 360, m, 120)} Z`
}

export interface PlanetInput {
  id: string
  minutes: number
  label: string
  time: string
  kind: 'event' | 'suggestion' | 'now'
}

export interface PlacedPlanet extends PlanetInput {
  x: number
  y: number
  labelX: number
  labelY: number
  anchor: 'start' | 'end'
}

type Box = [number, number, number, number] // x1, y1, x2, y2

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))

/**
 * Mette i pianeti sull'arco e sceglie per ogni etichetta il posto libero tra
 * sopra e sotto, a destra o a sinistra del pianeta. Si alterna sopra e sotto
 * come nel mockup; vicino al bordo destro l'etichetta passa a sinistra.
 */
export function placePlanets(planets: PlanetInput[], m: Mapping, width: number, charWidth = 6.9, fontSize = 13): PlacedPlanet[] {
  const sorted = [...planets].sort((a, b) => a.minutes - b.minutes)
  const positioned = sorted.map((p) => ({ p, ...timePoint(p.minutes, m) }))
  // i pianeti stessi sono ostacoli per le etichette
  const placed: Box[] = positioned.map(({ x, y, p }) => {
    const r = p.kind === 'now' ? 18 : 7
    return [x - r, y - r, x + r, y + r]
  })
  let preferAbove = true

  return positioned.map(({ p, x, y }) => {
    const text = p.kind === 'now' ? p.label : `${p.time} ${p.label}`
    const w = text.length * charWidth
    const r = p.kind === 'now' ? 18 : 6
    const gap = p.kind === 'now' ? 13 : 8
    const fits = x + gap + w <= width - 4
    const above = (box: [number, number]): Box => [box[0], y - r - 4 - fontSize, box[1], y - r - 2]
    const below = (box: [number, number]): Box => [box[0], y + r + 18 - fontSize, box[1], y + r + 20]
    const right: [number, number] = [x + gap, x + gap + w]
    const left: [number, number] = [x - gap - w, x - gap]
    const sides = p.kind === 'now' ? ['above', 'below'] : preferAbove ? ['above', 'below'] : ['below', 'above']
    const anchors = fits ? ['start', 'end'] : ['end', 'start']
    const candidates = anchors.flatMap((anchor) =>
      sides.map((side) => {
        const span = anchor === 'start' ? right : left
        const box = side === 'above' ? above(span) : below(span)
        const outside = box[0] < 0 || box[2] > width ? 1e6 : 0
        const cost = outside + placed.reduce((sum, b) => sum + overlap(box, b), 0)
        return { anchor: anchor as 'start' | 'end', side, box, cost }
      }),
    )
    const best = candidates.reduce((a, b) => (b.cost < a.cost ? b : a))
    placed.push(best.box)
    if (p.kind !== 'now') preferAbove = best.side !== 'above'
    return {
      ...p,
      x,
      y,
      anchor: best.anchor,
      labelX: best.anchor === 'start' ? x + gap : x - gap,
      labelY: best.side === 'above' ? y - r - 4 : y + r + 18,
    }
  })
}
