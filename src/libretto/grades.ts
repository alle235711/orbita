// Libretto: voti, medie, CFU, base di laurea e simulatore. Funzioni pure:
// nessun React, nessun database, nessun orologio. Nessuna regola d'ateneo è
// scritta qui: scala, divisore e bonus sono parametri.

import type { GraduationSettings } from '../db/settings'
import type { Course, ExamResult, ResultOutcome } from '../db/schema'
import { isISODate, isMonthOnly, parseISODate, toISODate, type ISODate } from '../lib/dates'

export const MIN_GRADE = 18
export const MAX_GRADE = 30
export const MAX_BONUSES = 8
const MAX_BONUS_LABEL = 40
const MAX_BONUS_POINTS = 100
const EPS = 1e-9

export interface GradeProfile {
  totalCfu: number
  lodeValue: number
}
export const DEFAULT_GRADE_PROFILE: GradeProfile = { totalCfu: 180, lodeValue: 30 }

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, Math.round(v)))
}

export function gradeProfile(p: Partial<GradeProfile> | null | undefined): GradeProfile {
  return {
    totalCfu: clampInt(p?.totalCfu, 1, 600, DEFAULT_GRADE_PROFILE.totalCfu),
    lodeValue: clampInt(p?.lodeValue, 30, 40, DEFAULT_GRADE_PROFILE.lodeValue),
  }
}

// ---------------------------------------------------------------- 2.1 righe e stato

const OUTCOMES: readonly ResultOutcome[] = ['superato', 'rifiutato', 'non-superato']
const isGradeInt = (g: unknown): g is number => typeof g === 'number' && Number.isInteger(g) && g >= MIN_GRADE && g <= MAX_GRADE

export function isUsable(r: ExamResult): boolean {
  if (!r || typeof r !== 'object' || r.deletedAt) return false
  if (typeof r.courseId !== 'string') return false
  if (!OUTCOMES.includes(r.outcome)) return false
  if (r.outcome === 'superato' && r.grade !== undefined && r.grade !== null && !isGradeInt(r.grade)) return false
  return true
}
export function isGradedPass(r: ExamResult): boolean {
  return isUsable(r) && r.outcome === 'superato' && isGradeInt(r.grade)
}
export function isIdoneita(r: ExamResult): boolean {
  return isUsable(r) && r.outcome === 'superato' && (r.grade === undefined || r.grade === null)
}
export function isAttempt(r: ExamResult): boolean {
  return isUsable(r) && r.outcome !== 'superato'
}

const byOld = (a: ExamResult, b: ExamResult) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || a.updatedAt - b.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const byNew = (a: ExamResult, b: ExamResult) =>
  (a.date < b.date ? 1 : a.date > b.date ? -1 : 0) || b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Risultati utilizzabili di un esame, dal più vecchio. */
export function resultsOf(courseId: string, results: ExamResult[]): ExamResult[] {
  return results.filter((r) => isUsable(r) && r.courseId === courseId).sort(byOld)
}

export type CourseStatus = { kind: 'superato'; result: ExamResult } | { kind: 'aperto'; attempts: ExamResult[] }

/** L'ultimo risultato decide: un superato chiude l'esame, altrimenti resta aperto. */
export function courseStatus(courseId: string, results: ExamResult[]): CourseStatus {
  const all = resultsOf(courseId, results)
  const last = all[all.length - 1]
  if (last && last.outcome === 'superato') return { kind: 'superato', result: last }
  return { kind: 'aperto', attempts: all.filter((r) => r.outcome !== 'superato') }
}

const aliveCourses = (courses: Course[]): Course[] => courses.filter((c) => !c.deletedAt)

/** Esami vivi ancora da fare: l'unico punto che decide cosa esce da piano, coda, righello e Registra. */
export function activeCourses(courses: Course[], results: ExamResult[]): Course[] {
  return aliveCourses(courses).filter((c) => courseStatus(c.id, results).kind === 'aperto')
}

export interface PassedRow {
  course: Course
  result: ExamResult
}
export interface AttemptRow {
  course: Course
  result: ExamResult
}

export function passedRows(courses: Course[], results: ExamResult[]): PassedRow[] {
  const rows: PassedRow[] = []
  for (const course of aliveCourses(courses)) {
    const s = courseStatus(course.id, results)
    if (s.kind === 'superato') rows.push({ course, result: s.result })
  }
  return rows.sort((a, b) => (a.result.date < b.result.date ? 1 : a.result.date > b.result.date ? -1 : 0) || a.course.name.localeCompare(b.course.name, 'it'))
}

export function attemptRows(courses: Course[], results: ExamResult[]): AttemptRow[] {
  const rows: AttemptRow[] = []
  for (const course of aliveCourses(courses)) {
    for (const result of resultsOf(course.id, results)) if (result.outcome !== 'superato') rows.push({ course, result })
  }
  return rows.sort((a, b) => byNew(a.result, b.result))
}

// ---------------------------------------------------------------- 2.2 voti, medie, CFU

export function gradeValue(r: ExamResult, lodeValue: number): number | null {
  if (!isGradedPass(r)) return null
  return r.lode === true && r.grade === MAX_GRADE ? lodeValue : (r.grade as number)
}

export interface GradedEntry {
  course: Course
  result: ExamResult
  value: number
  cfu: number | undefined
  lode: boolean
}

const knownCfu = (c: Course): number | undefined => (typeof c.cfu === 'number' && Number.isFinite(c.cfu) && c.cfu > 0 ? c.cfu : undefined)

export function gradedEntries(courses: Course[], results: ExamResult[], profile: GradeProfile): GradedEntry[] {
  const out: GradedEntry[] = []
  for (const course of aliveCourses(courses)) {
    const s = courseStatus(course.id, results)
    if (s.kind !== 'superato') continue
    const value = gradeValue(s.result, profile.lodeValue)
    if (value === null) continue
    out.push({ course, result: s.result, value, cfu: knownCfu(course), lode: s.result.lode === true && s.result.grade === MAX_GRADE })
  }
  return out
}

export function arithmeticMean(courses: Course[], results: ExamResult[], profile: GradeProfile): number | null {
  const e = gradedEntries(courses, results, profile)
  return e.length ? e.reduce((s, x) => s + x.value, 0) / e.length : null
}

export function meanParts(courses: Course[], results: ExamResult[], profile: GradeProfile): { points: number; weights: number } {
  let points = 0
  let weights = 0
  for (const e of gradedEntries(courses, results, profile)) {
    if (e.cfu === undefined) continue
    points += e.cfu * e.value
    weights += e.cfu
  }
  return { points, weights }
}

export function weightedMean(courses: Course[], results: ExamResult[], profile: GradeProfile): number | null {
  const { points, weights } = meanParts(courses, results, profile)
  return weights > 0 ? points / weights : null
}

export function lodeCount(courses: Course[], results: ExamResult[]): number {
  return gradedEntries(courses, results, DEFAULT_GRADE_PROFILE).filter((e) => e.lode).length
}

export interface CfuStatus {
  total: number
  earned: number
  missing: number
  fraction: number
  unknownCfu: number
}

export function cfuStatus(courses: Course[], results: ExamResult[], profile: GradeProfile): CfuStatus {
  let earned = 0
  let unknownCfu = 0
  for (const course of aliveCourses(courses)) {
    if (courseStatus(course.id, results).kind !== 'superato') continue
    const cfu = knownCfu(course)
    if (cfu === undefined) unknownCfu++
    else earned += cfu
  }
  const total = profile.totalCfu
  return { total, earned, missing: Math.max(0, total - earned), fraction: total > 0 ? Math.min(1, earned / total) : 0, unknownCfu }
}

// ---------------------------------------------------------------- 2.3 base di laurea

export type BonusKind = 'fixed' | 'perLode'
export interface GraduationBonus {
  id: string
  label: string
  kind: BonusKind
  points: number
}
export interface GraduationFormula {
  scale: number
  divisor: number
  bonuses: GraduationBonus[]
}
export const DEFAULT_FORMULA: GraduationFormula = { scale: 110, divisor: 30, bonuses: [] }
export const DEFAULT_GRADUATION: GraduationSettings = { formula: DEFAULT_FORMULA }

function inRange(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback
}

export function normalizeFormula(raw: unknown): GraduationFormula {
  const o = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const list = Array.isArray(o.bonuses) ? o.bonuses : []
  const bonuses: GraduationBonus[] = []
  const seen = new Set<string>()
  for (const item of list) {
    if (bonuses.length >= MAX_BONUSES) break
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue
    const b = item as Record<string, unknown>
    let id = typeof b.id === 'string' && b.id ? b.id : `b${bonuses.length}`
    for (let n = 2; seen.has(id); n++) id = `${typeof b.id === 'string' && b.id ? b.id : `b${bonuses.length}`}-${n}`
    seen.add(id)
    const p = typeof b.points === 'number' && Number.isFinite(b.points) ? b.points : 0
    bonuses.push({
      id,
      label: typeof b.label === 'string' ? b.label.trim().slice(0, MAX_BONUS_LABEL) : '',
      kind: b.kind === 'perLode' ? 'perLode' : 'fixed',
      points: Math.round(Math.min(MAX_BONUS_POINTS, Math.max(-MAX_BONUS_POINTS, p)) * 100) / 100,
    })
  }
  return { scale: inRange(o.scale, 1, 1000, 110), divisor: inRange(o.divisor, 1, 100, 30), bonuses }
}

export function normalizeGraduation(raw: unknown): GraduationSettings {
  const o = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  return { formula: normalizeFormula(o.formula) }
}

export interface GraduationBase {
  mean: number
  scaled: number
  parts: { id: string; label: string; points: number }[]
  bonus: number
  total: number
  lodes: number
}

export function graduationBase(mean: number | null, lodes: number, formula: GraduationFormula): GraduationBase | null {
  if (mean === null || !Number.isFinite(mean)) return null
  if (!Number.isFinite(formula.divisor) || formula.divisor <= 0) return null
  const scaled = (mean * formula.scale) / formula.divisor
  const parts = formula.bonuses.map((b) => ({ id: b.id, label: b.label, points: b.kind === 'perLode' ? b.points * lodes : b.points }))
  const bonus = parts.reduce((s, p) => s + p.points, 0)
  return { mean, scaled, parts, bonus, total: scaled + bonus, lodes }
}

// ---------------------------------------------------------------- 2.4 simulatore

export interface Remaining {
  exams: number
  cfu: number
}

export function remainingExams(courses: Course[], results: ExamResult[]): Remaining {
  let exams = 0
  let cfu = 0
  for (const c of activeCourses(courses, results)) {
    const k = knownCfu(c)
    if (k === undefined) continue
    exams++
    cfu += k
  }
  return { exams, cfu }
}

export type RequiredAverage =
  | { kind: 'reached' }
  | { kind: 'possible'; needed: number; neededRounded: number }
  | { kind: 'impossible'; best: number | null }

export function requiredAverage(input: {
  points: number
  weights: number
  remainingCfu: number
  target: number
  minGrade?: number
  maxGrade?: number
}): RequiredAverage {
  const minGrade = input.minGrade ?? MIN_GRADE
  const maxGrade = input.maxGrade ?? MAX_GRADE
  const { points, weights, remainingCfu, target } = input
  if (![points, weights, remainingCfu, target, minGrade, maxGrade].every(Number.isFinite)) return { kind: 'impossible', best: null }
  const R = Math.max(0, remainingCfu)
  const W = Math.max(0, weights)
  if (R === 0) {
    const current = W > 0 ? points / W : null
    return current !== null && current >= target - EPS ? { kind: 'reached' } : { kind: 'impossible', best: current }
  }
  const Y = (target * (W + R) - points) / R
  if (Y <= minGrade + EPS) return { kind: 'reached' }
  if (Y > maxGrade + EPS) return { kind: 'impossible', best: (points + maxGrade * R) / (W + R) }
  const rounded = Math.min(maxGrade, Math.max(minGrade, Math.ceil(Y * 10 - EPS) / 10))
  return { kind: 'possible', needed: Y, neededRounded: rounded }
}

// ---------------------------------------------------------------- 2.5 composto

export interface Gradebook {
  passed: PassedRow[]
  attempts: AttemptRow[]
  weighted: number | null
  arithmetic: number | null
  gradedCount: number
  gradedWithoutCfu: number
  cfu: CfuStatus
  lodes: number
  base: GraduationBase | null
  remaining: Remaining
  required: RequiredAverage
}

export function buildGradebook(input: {
  courses: Course[]
  results: ExamResult[]
  profile: GradeProfile
  formula: GraduationFormula
  target: number
}): Gradebook {
  const { courses, results, profile, formula, target } = input
  const entries = gradedEntries(courses, results, profile)
  const parts = meanParts(courses, results, profile)
  const weighted = parts.weights > 0 ? parts.points / parts.weights : null
  const lodes = entries.filter((e) => e.lode).length
  const remaining = remainingExams(courses, results)
  return {
    passed: passedRows(courses, results),
    attempts: attemptRows(courses, results),
    weighted,
    arithmetic: entries.length ? entries.reduce((s, e) => s + e.value, 0) / entries.length : null,
    gradedCount: entries.length,
    gradedWithoutCfu: entries.filter((e) => e.cfu === undefined).length,
    cfu: cfuStatus(courses, results, profile),
    lodes,
    base: graduationBase(weighted, lodes, formula),
    remaining,
    required: requiredAverage({ ...parts, remainingCfu: remaining.cfu, target }),
  }
}

/** Cosa mostra il simulatore: senza voti con CFU (nessuna media) non c'è un numero da chiedere. */
export type SimulatorMode = 'noExams' | 'noData' | 'done' | 'sentence'
export function simulatorMode(book: Pick<Gradebook, 'remaining' | 'gradedCount' | 'weighted'>): SimulatorMode {
  if (book.remaining.cfu === 0) return book.gradedCount === 0 ? 'noExams' : 'done'
  return book.weighted === null ? 'noData' : 'sentence'
}

// ---------------------------------------------------------------- 2.6 bozza

export interface ResultDraft {
  courseId: string
  date: string
  outcome: ResultOutcome
  grade?: number | null
  lode?: boolean
}
export type ResultField = 'course' | 'date' | 'grade'
export type ResultErrorCode = 'required' | 'invalid' | 'range' | 'lodeNeeds30'

export function isRealDay(s: string): boolean {
  if (!isISODate(s) || isMonthOnly(s)) return false
  const d = parseISODate(s)
  return !Number.isNaN(d.getTime()) && toISODate(d) === (s as ISODate)
}

export function validateResultDraft(d: ResultDraft, courseIds: ReadonlySet<string>): Partial<Record<ResultField, ResultErrorCode>> | null {
  const errors: Partial<Record<ResultField, ResultErrorCode>> = {}
  if (!d.courseId) errors.course = 'required'
  else if (!courseIds.has(d.courseId)) errors.course = 'invalid'
  if (!d.date) errors.date = 'required'
  else if (!isRealDay(d.date)) errors.date = 'invalid'
  if (d.outcome === 'superato') {
    const g = d.grade
    if (g !== undefined && g !== null) {
      if (typeof g !== 'number' || !Number.isInteger(g)) errors.grade = 'invalid'
      else if (g < MIN_GRADE || g > MAX_GRADE) errors.grade = 'range'
    }
    if (d.lode === true && !errors.grade && g !== MAX_GRADE) errors.grade = 'lodeNeeds30'
  }
  return Object.keys(errors).length ? errors : null
}

export function canonicalResult(d: ResultDraft): Pick<ExamResult, 'courseId' | 'date' | 'outcome' | 'grade' | 'lode'> {
  const base = { courseId: d.courseId, date: d.date, outcome: d.outcome }
  if (d.outcome !== 'superato') return base
  const grade = typeof d.grade === 'number' && Number.isInteger(d.grade) ? d.grade : undefined
  return {
    ...base,
    ...(grade !== undefined ? { grade } : {}),
    ...(grade === MAX_GRADE && d.lode === true ? { lode: true } : {}),
  }
}

// ---------------------------------------------------------------- bersaglio

/** Non numerico -> 28; altrimenti tra 18 e 30, a un decimale. */
export function normalizeTargetAverage(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 28
  return Math.round(Math.min(MAX_GRADE, Math.max(MIN_GRADE, raw)) * 10) / 10
}
