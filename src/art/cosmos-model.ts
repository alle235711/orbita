// Composizione pura: esami + risultati + oggi + impianto + catture in sospeso
// → cosa disegnare e cosa elencare. Non muta gli ingressi.

import type { Course, ExamResult } from '../db/schema'
import type { PendingCapture } from '../db/settings'
import type { ISODate } from '../lib/dates'
import { courseStatus } from '../libretto/grades'
import {
  celestialState,
  examTarget,
  layoutComets,
  layoutMoons,
  type CelestialState,
  type CometInput,
  type CometPlacement,
  type CosmosLayout,
  type MoonInput,
  type MoonPlacement,
  type Point,
} from './celestial'

type CometState = Extract<CelestialState, { kind: 'comet' | 'periodic' }>

export interface CometItem extends CometPlacement {
  courseId: string
  name: string
  state: CometState
}
export interface MoonItem extends MoonPlacement {
  courseId: string
  resultId: string
  name: string
  capturing: boolean
}
export interface CaptureItem {
  resultId: string
  courseId: string
  name: string
  from: Point
  startTail: number
  moon: MoonPlacement
}
export interface ListComet {
  courseId: string
  name: string
  state: CometState
}
export interface ListMoon {
  courseId: string
  name: string
  grade: number
  lode: boolean
  date: string
}
export interface CosmosModel {
  comets: CometItem[]
  moons: MoonItem[]
  captures: CaptureItem[]
  stale: string[]
  list: { comets: ListComet[]; moons: ListMoon[] }
}

/** Quante catture si animano insieme; le altre si consumano senza animazione. */
const MAX_CAPTURES = 3

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function composeCosmos(i: { courses: Course[]; results: ExamResult[]; today: ISODate; layout: CosmosLayout; pending: PendingCapture[] }): CosmosModel {
  const { courses, results, today, layout } = i
  const byId = new Map(courses.map((c) => [c.id, c]))
  const states = new Map(courses.map((c) => [c.id, celestialState(c, results, today)]))

  // 2. Catture in sospeso: valide solo se il risultato che decide è proprio quello.
  const stale: string[] = []
  const wanted: { resultId: string; courseId: string }[] = []
  const seenResult = new Set<string>()
  for (const p of i.pending) {
    if (seenResult.has(p.resultId)) continue
    seenResult.add(p.resultId)
    const course = byId.get(p.courseId)
    const status = course ? courseStatus(course.id, results) : null
    const valid = !!course && states.get(course.id)?.kind === 'moon' && status?.kind === 'superato' && status.result.id === p.resultId
    if (valid && wanted.length < MAX_CAPTURES) wanted.push(p)
    else stale.push(p.resultId)
  }
  const capturingIds = new Set(wanted.map((w) => w.courseId))

  // 3. Comete: quelle in cielo più le teste che stanno per essere catturate (tengono il loro posto).
  const cometInputs: CometInput[] = []
  for (const c of courses) {
    const s = states.get(c.id)!
    if (s.kind === 'comet' || s.kind === 'periodic') cometInputs.push({ id: c.id, days: s.days, periodic: s.kind === 'periodic' })
  }
  for (const w of wanted) {
    const t = examTarget(byId.get(w.courseId)!.examDate, today)
    cometInputs.push({ id: w.courseId, days: typeof t === 'object' ? Math.max(0, t.days) : 0 })
  }
  const placements = layoutComets(cometInputs, layout.comets)
  const placementOf = new Map(placements.map((p) => [p.id, p]))

  const comets: CometItem[] = []
  for (const p of placements) {
    if (capturingIds.has(p.id)) continue
    const c = byId.get(p.id)!
    comets.push({ ...p, courseId: c.id, name: c.name, state: states.get(c.id) as CometState })
  }

  // 4. Lune.
  const moonInputs: MoonInput[] = []
  const decidingResult = new Map<string, string>()
  for (const c of courses) {
    const s = states.get(c.id)!
    if (s.kind !== 'moon') continue
    moonInputs.push({ id: c.id, grade: s.grade, lode: s.lode, date: s.date })
    const st = courseStatus(c.id, results)
    if (st.kind === 'superato') decidingResult.set(c.id, st.result.id)
  }
  const moonPlacements = layoutMoons(moonInputs, layout.moons)
  const moonOf = new Map(moonPlacements.map((m) => [m.id, m]))

  const captures: CaptureItem[] = []
  for (const w of wanted) {
    const moon = moonOf.get(w.courseId)
    if (!moon) {
      stale.push(w.resultId)
      continue
    }
    const from = placementOf.get(w.courseId)
    // Una testa fuori da maxComets non ha posto: la cattura parte dall'angolo e dalla distanza minimi.
    const start = from ?? { x: moon.x, y: moon.y, tail: 0 }
    captures.push({ resultId: w.resultId, courseId: w.courseId, name: byId.get(w.courseId)!.name, from: { x: start.x, y: start.y }, startTail: start.tail, moon })
  }
  const capturing = new Set(captures.map((c) => c.courseId))
  const moons: MoonItem[] = moonPlacements.map((m) => ({
    ...m,
    courseId: m.id,
    resultId: decidingResult.get(m.id)!,
    name: byId.get(m.id)!.name,
    capturing: capturing.has(m.id),
  }))

  // 5. Elenchi per i lettori di schermo: tutto, senza limiti.
  const listComets: ListComet[] = []
  const listMoons: ListMoon[] = []
  for (const c of courses) {
    const s = states.get(c.id)!
    if (s.kind === 'comet' || s.kind === 'periodic') listComets.push({ courseId: c.id, name: c.name, state: s })
    else if (s.kind === 'moon') listMoons.push({ courseId: c.id, name: c.name, grade: s.grade, lode: s.lode, date: s.date })
  }
  listComets.sort((a, b) => {
    const da = a.state.date
    const db = b.state.date
    if (da === null && db !== null) return 1
    if (da !== null && db === null) return -1
    return (da !== null && db !== null ? cmp(da, db) : 0) || a.name.localeCompare(b.name)
  })
  listMoons.sort((a, b) => cmp(b.date, a.date) || a.name.localeCompare(b.name))

  return { comets, moons, captures, stale, list: { comets: listComets, moons: listMoons } }
}
