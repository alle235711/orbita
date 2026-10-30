// Multiverso degli appelli: la matematica pura. Niente React, niente Dexie,
// niente orologio (sempre `today` come argomento), niente casualità. Ignora le
// righe cancellate e non modifica mai gli argomenti.

import type { Appello, Course, Deadline, ExamResult, Universe } from '../db/schema'
import { DEFAULT_MULTIVERSE, type MultiverseParams } from '../db/settings'
import { addDays, diffDays, isISODate, isMonthOnly, lastDayOfMonth, resolveDate, weekStart, type ISODate } from '../lib/dates'
import { activeCourses, graduationBase, isRealDay, lodeCount, MAX_GRADE, MIN_GRADE, meanParts, weightedMean, type GradeProfile, type GraduationBase, type GraduationFormula } from '../libretto/grades'

export { DEFAULT_MULTIVERSE }
export type { MultiverseParams }
export const MIN_UNIVERSES = 2
export const MAX_UNIVERSES = 4
export const MAX_NOTE = 80
const CLOSE_RANGE = [1, 30] as const
const GAP_RANGE = [0, 365] as const
const EPS = 1e-9

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const num = (v: unknown, lo: number, hi: number, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? clamp(Math.round(v), lo, hi) : fallback)

export function normalizeMultiverse(raw: unknown): MultiverseParams {
  const o = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    closeDays: num(o.closeDays, CLOSE_RANGE[0], CLOSE_RANGE[1], DEFAULT_MULTIVERSE.closeDays),
    finalGapDays: num(o.finalGapDays, GAP_RANGE[0], GAP_RANGE[1], DEFAULT_MULTIVERSE.finalGapDays),
  }
}

/** Un giorno reale 'YYYY-MM-DD' o un mese 'YYYY-MM' (01..12). */
export function isUsableDate(s: unknown): s is string {
  if (typeof s !== 'string') return false
  if (isISODate(s)) return isRealDay(s)
  if (isMonthOnly(s)) {
    const m = Number(s.slice(5))
    return m >= 1 && m <= 12
  }
  return false
}

// --- 3.1 appelli -----------------------------------------------------------

export interface SittingInfo {
  id: string
  courseId: string
  date: string
  monthOnly: boolean
  lo: ISODate
  hi: ISODate
  resolved: ISODate
  expired: boolean
  note?: string
}

const maxDay = (a: ISODate, b: ISODate) => (a >= b ? a : b)
const minDay = (a: ISODate, b: ISODate) => (a <= b ? a : b)

export function sittingInfo(a: Appello, today: ISODate): SittingInfo | null {
  if (a.deletedAt || !isUsableDate(a.date)) return null
  const base = { id: a.id, courseId: a.courseId, date: a.date, ...(a.note ? { note: a.note } : {}) }
  if (isMonthOnly(a.date)) {
    const hi = lastDayOfMonth(a.date)
    const lo = minDay(maxDay(`${a.date}-01`, today), hi)
    return { ...base, monthOnly: true, lo, hi, resolved: maxDay(`${a.date}-15`, today), expired: hi < today }
  }
  return { ...base, monthOnly: false, lo: a.date, hi: a.date, resolved: a.date, expired: a.date < today }
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const byResolved = (a: { resolved: ISODate; id: string }, b: { resolved: ISODate; id: string }) => cmp(a.resolved, b.resolved) || cmp(a.id, b.id)

export function sittingsOf(courseId: string, appelli: Appello[], today: ISODate): SittingInfo[] {
  const out: SittingInfo[] = []
  for (const a of appelli) {
    if (a.courseId !== courseId) continue
    const info = sittingInfo(a, today)
    if (info) out.push(info)
  }
  return out.sort(byResolved)
}

/** Esami del multiverso: da fare e con almeno un appello utilizzabile (anche passato). */
export function examSet(courses: Course[], results: ExamResult[], appelli: Appello[], today: ISODate): Course[] {
  return activeCourses(courses, results).filter((c) => sittingsOf(c.id, appelli, today).length > 0)
}

export function suggestPicks(courses: Course[], results: ExamResult[], appelli: Appello[], today: ISODate, index: number): Record<string, string> {
  const out: Record<string, string> = {}
  for (const c of examSet(courses, results, appelli, today)) {
    const open = sittingsOf(c.id, appelli, today).filter((s) => !s.expired)
    if (!open.length) continue
    out[c.id] = open[Math.min(Math.max(0, index), open.length - 1)]!.id
  }
  return out
}

// --- periodi ---------------------------------------------------------------

export interface PeriodSpan {
  id: string
  name: string
  start: ISODate
  end: ISODate
}

/** I periodi speciali utilizzabili, in ordine di id. */
export function periodSpans(deadlines: Deadline[]): PeriodSpan[] {
  const out: PeriodSpan[] = []
  for (const d of deadlines) {
    if (d.deletedAt || d.kind !== 'periodo' || !isUsableDate(d.date) || !isUsableDate(d.endDate)) continue
    const start = resolveDate(d.date)
    const end = isMonthOnly(d.endDate) ? lastDayOfMonth(d.endDate) : d.endDate
    if (end < start) continue
    out.push({ id: d.id, name: d.title, start, end })
  }
  return out.sort((a, b) => cmp(a.id, b.id))
}

// --- 3.2 valutazione --------------------------------------------------------

export interface EvaluateInput {
  universe: Pick<Universe, 'id' | 'picks' | 'grades'>
  courses: Course[]
  results: ExamResult[]
  appelli: Appello[]
  periods: Deadline[]
  today: ISODate
  params: MultiverseParams
  profile: GradeProfile
  formula: GraduationFormula
}

export interface ExamEntry {
  courseId: string
  name: string
  appelloId: string
  date: string
  monthOnly: boolean
  lo: ISODate
  hi: ISODate
  resolved: ISODate
  days: number
  cfu: number | undefined
  expectedGrade: number | null
  gradeSource: 'override' | 'default' | 'none'
}
export interface ClosePair {
  a: string
  b: string
  gap: number
  minGap: number
  maxGap: number
  uncertain: boolean
}
export interface PeriodConflict {
  courseId: string
  periodId: string
  periodName: string
  uncertain: boolean
}
export interface WeekLoad {
  week: ISODate
  cfu: number
}
export interface UniverseEvaluation {
  universeId: string
  exams: ExamEntry[]
  missingPicks: string[]
  complete: boolean
  weeklyLoad: WeekLoad[]
  peak: WeekLoad | null
  totalCfu: number
  unknownCfu: number
  tooClose: ClosePair[]
  periodConflicts: PeriodConflict[]
  graduationDate: ISODate | null
  graduationEarliest: ISODate | null
  graduationLatest: ISODate | null
  graduationUncertain: boolean
  expectedAverage: number | null
  expectedBase: GraduationBase | null
  counts: { certain: number; uncertain: number }
}

const cfuOf = (c: Course): number | undefined => (typeof c.cfu === 'number' && Number.isFinite(c.cfu) && c.cfu > 0 ? c.cfu : undefined)

function weeklyLoadOf(exams: ExamEntry[], today: ISODate): WeekLoad[] {
  if (!exams.length) return []
  const first = weekStart(today)
  const last = weekStart(exams[exams.length - 1]!.resolved)
  const weeks: WeekLoad[] = []
  const index = new Map<ISODate, WeekLoad>()
  for (let w = first; w <= last; w = addDays(w, 7)) {
    const row = { week: w, cfu: 0 }
    weeks.push(row)
    index.set(w, row)
  }
  exams.forEach((e, i) => {
    if (e.cfu === undefined) return
    let start = i === 0 ? today : addDays(exams[i - 1]!.resolved, 1)
    if (start > e.resolved) start = e.resolved
    const n = diffDays(start, e.resolved) + 1
    const perDay = e.cfu / n
    for (let d = 0; d < n; d++) {
      const row = index.get(weekStart(addDays(start, d)))
      if (row) row.cfu += perDay
    }
  })
  return weeks
}

export function evaluateUniverse(input: EvaluateInput): UniverseEvaluation {
  const { universe, courses, results, appelli, periods, today, params, profile, formula } = input
  const set = examSet(courses, results, appelli, today)
  const exams: ExamEntry[] = []
  const missingPicks: string[] = []
  const current = weightedMean(courses, results, profile)
  for (const c of set) {
    const id = universe.picks[c.id]
    const a = typeof id === 'string' ? appelli.find((x) => x.id === id && x.courseId === c.id) : undefined
    const s = a ? sittingInfo(a, today) : null
    if (!s || s.expired) {
      missingPicks.push(c.id)
      continue
    }
    const override = universe.grades[c.id]
    const hasOverride = typeof override === 'number' && Number.isFinite(override)
    exams.push({
      courseId: c.id,
      name: c.name,
      appelloId: s.id,
      date: s.date,
      monthOnly: s.monthOnly,
      lo: s.lo,
      hi: s.hi,
      resolved: s.resolved,
      days: Math.max(0, diffDays(today, s.resolved)),
      cfu: cfuOf(c),
      expectedGrade: hasOverride ? clamp(override, MIN_GRADE, MAX_GRADE) : current,
      gradeSource: hasOverride ? 'override' : current !== null ? 'default' : 'none',
    })
  }
  exams.sort((a, b) => cmp(a.resolved, b.resolved) || cmp(a.courseId, b.courseId))

  const weeklyLoad = weeklyLoadOf(exams, today)
  let peak: WeekLoad | null = null
  for (const w of weeklyLoad) if (!peak || w.cfu > peak.cfu + EPS) peak = { ...w }
  const totalCfu = exams.reduce((s, e) => s + (e.cfu ?? 0), 0)
  const unknownCfu = exams.filter((e) => e.cfu === undefined).length

  // Troppo vicini: a distanza minima <= soglia (la soglia è compresa).
  const k = params.closeDays
  const tooClose: ClosePair[] = []
  for (let i = 0; i < exams.length; i++)
    for (let j = i + 1; j < exams.length; j++) {
      const a = exams[i]!
      const b = exams[j]!
      const minGap = Math.max(0, diffDays(a.hi, b.lo), diffDays(b.hi, a.lo))
      const maxGap = Math.max(diffDays(a.lo, b.hi), diffDays(b.lo, a.hi))
      if (minGap > k) continue
      tooClose.push({ a: a.courseId, b: b.courseId, gap: Math.abs(diffDays(a.resolved, b.resolved)), minGap, maxGap, uncertain: maxGap > k })
    }
  const order = new Map(exams.map((e, i) => [e.courseId, i]))
  tooClose.sort((p, q) => order.get(p.a)! - order.get(q.a)! || order.get(p.b)! - order.get(q.b)!)

  const periodConflicts: PeriodConflict[] = []
  for (const e of exams)
    for (const p of periodSpans(periods)) {
      if (e.hi < p.start || e.lo > p.end) continue
      periodConflicts.push({ courseId: e.courseId, periodId: p.id, periodName: p.name, uncertain: !(e.lo >= p.start && e.hi <= p.end) })
    }

  let graduationDate: ISODate | null = null
  let graduationEarliest: ISODate | null = null
  let graduationLatest: ISODate | null = null
  if (exams.length) {
    const gap = params.finalGapDays
    graduationDate = addDays(exams.reduce((m, e) => maxDay(m, e.resolved), exams[0]!.resolved), gap)
    graduationEarliest = addDays(exams.reduce((m, e) => maxDay(m, e.lo), exams[0]!.lo), gap)
    graduationLatest = addDays(exams.reduce((m, e) => maxDay(m, e.hi), exams[0]!.hi), gap)
  }

  const parts = meanParts(courses, results, profile)
  let points = parts.points
  let weights = parts.weights
  for (const e of exams) {
    if (e.cfu === undefined || e.expectedGrade === null) continue
    points += e.cfu * e.expectedGrade
    weights += e.cfu
  }
  const expectedAverage = weights > 0 ? points / weights : null
  const expectedBase = graduationBase(expectedAverage, lodeCount(courses, results), formula)

  const counts = {
    certain: tooClose.filter((p) => !p.uncertain).length + periodConflicts.filter((p) => !p.uncertain).length,
    uncertain: tooClose.filter((p) => p.uncertain).length + periodConflicts.filter((p) => p.uncertain).length,
  }
  return {
    universeId: universe.id,
    exams,
    missingPicks,
    complete: missingPicks.length === 0 && exams.length > 0,
    weeklyLoad,
    peak,
    totalCfu,
    unknownCfu,
    tooClose,
    periodConflicts,
    graduationDate,
    graduationEarliest,
    graduationLatest,
    graduationUncertain: graduationEarliest !== graduationLatest,
    expectedAverage,
    expectedBase,
    counts,
  }
}

// --- 3.9 confronto e applicazione -------------------------------------------

export interface Comparison {
  earliestGraduation: string[]
  fewestConflicts: string[]
  lightestPeak: string[]
}

/** Vincono tutti i candidati col valore migliore; se discrimina meno di due, nessuno. */
function winners<T>(items: { id: string; value: T }[], compare: (a: T, b: T) => number): string[] {
  if (items.length < 2) return []
  const best = items.reduce((m, x) => (compare(x.value, m) < 0 ? x.value : m), items[0]!.value)
  const win = items.filter((x) => compare(x.value, best) === 0)
  return win.length === items.length ? [] : win.map((x) => x.id)
}

export function compareUniverses(evals: UniverseEvaluation[]): Comparison {
  const done = evals.filter((e) => e.complete)
  return {
    earliestGraduation: winners(
      done.filter((e) => e.graduationDate !== null).map((e) => ({ id: e.universeId, value: e.graduationDate! })),
      cmp,
    ),
    fewestConflicts: winners(
      done.map((e) => ({ id: e.universeId, value: e.counts })),
      (a, b) => a.certain - b.certain || a.uncertain - b.uncertain,
    ),
    lightestPeak: winners(
      done.filter((e) => e.peak !== null).map((e) => ({ id: e.universeId, value: e.peak!.cfu })),
      (a, b) => (Math.abs(a - b) <= EPS ? 0 : a - b),
    ),
  }
}

export interface ExamDateChange {
  courseId: string
  name: string
  from: string | undefined
  to: string
}

export function applyUniverse(evaluation: UniverseEvaluation, courses: Course[]): ExamDateChange[] {
  const out: ExamDateChange[] = []
  for (const e of evaluation.exams) {
    const c = courses.find((x) => x.id === e.courseId && !x.deletedAt)
    if (!c || c.examDate === e.date) continue
    out.push({ courseId: e.courseId, name: e.name, from: c.examDate, to: e.date })
  }
  return out
}
