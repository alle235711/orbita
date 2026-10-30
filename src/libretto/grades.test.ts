import { describe, expect, it } from 'vitest'
import type { Course, ExamResult } from '../db/schema'
import {
  DEFAULT_FORMULA,
  activeCourses,
  arithmeticMean,
  attemptRows,
  buildGradebook,
  canonicalResult,
  cfuStatus,
  courseStatus,
  gradeProfile,
  gradedEntries,
  graduationBase,
  lodeCount,
  meanParts,
  normalizeFormula,
  normalizeTargetAverage,
  passedRows,
  remainingExams,
  requiredAverage,
  simulatorMode,
  validateResultDraft,
  weightedMean,
  type GraduationFormula,
} from './grades'

const course = (id: string, cfu?: number, extra: Partial<Course> = {}): Course => ({ id, name: `Esame ${id}`, sections: [], difficulty: 2, updatedAt: 0, ...(cfu ? { cfu } : {}), ...extra })
const COURSES = [course('A', 12), course('B', 6), course('C', 9), course('D', 6), course('E', 12), course('F', 9), course('G', 6)]
let n = 0
const res = (courseId: string, extra: Partial<ExamResult> = {}): ExamResult => ({ id: `r${++n}`, courseId, date: '2026-06-01', outcome: 'superato', updatedAt: 1, ...extra })
const W1 = (): ExamResult[] => [
  res('A', { grade: 30, lode: true, date: '2026-06-10' }),
  res('B', { grade: 27 }),
  res('C', { grade: 24 }),
  res('D'),
  res('E', { outcome: 'rifiutato' }),
]
const P30 = gradeProfile({ totalCfu: 180, lodeValue: 30 })
const P31 = gradeProfile({ totalCfu: 180, lodeValue: 31 })
const P33 = gradeProfile({ totalCfu: 180, lodeValue: 33 })
const near = (a: number | null, b: number) => expect(a).toBeCloseTo(b, 6)

describe('W1', () => {
  it('means by lode value', () => {
    const r = W1()
    near(weightedMean(COURSES, r, P30), 738 / 27)
    near(arithmeticMean(COURSES, r, P30), 27)
    near(weightedMean(COURSES, r, P31), 750 / 27)
    near(arithmeticMean(COURSES, r, P31), 82 / 3)
    near(weightedMean(COURSES, r, P33), 774 / 27)
    near(arithmeticMean(COURSES, r, P33), 28)
    expect(meanParts(COURSES, r, P30)).toEqual({ points: 738, weights: 27 })
  })
  it('cfu, lodes, active courses', () => {
    const r = W1()
    const c = cfuStatus(COURSES, r, P30)
    expect(c).toMatchObject({ earned: 33, missing: 147, unknownCfu: 0 })
    expect(c.fraction).toBeCloseTo(33 / 180)
    expect(lodeCount(COURSES, r)).toBe(1)
    expect(activeCourses(COURSES, r).map((x) => x.id)).toEqual(['E', 'F', 'G'])
  })
  it('lode on a grade other than 30 is ignored', () => {
    const r = [res('A', { grade: 29, lode: true })]
    expect(gradedEntries(COURSES, r, P33)[0]).toMatchObject({ value: 29, lode: false })
  })
  it('course without cfu stays in the arithmetic mean and lodes only', () => {
    const cs = [course('A'), ...COURSES.slice(1)]
    const r = W1()
    near(arithmeticMean(cs, r, P30), 27)
    near(weightedMean(cs, r, P30), (6 * 27 + 9 * 24) / 15)
    expect(lodeCount(cs, r)).toBe(1)
    expect(cfuStatus(cs, r, P30)).toMatchObject({ earned: 21, unknownCfu: 1 })
  })
})

describe('status and rows', () => {
  it('latest result decides; deleting the later row restores the pass', () => {
    const pass = res('A', { grade: 28, date: '2026-05-01' })
    const later = res('A', { outcome: 'non-superato', date: '2026-06-01' })
    expect(courseStatus('A', [pass, later]).kind).toBe('aperto')
    expect(courseStatus('A', [pass, { ...later, deletedAt: 5 }]).kind).toBe('superato')
  })
  it('same date: updatedAt then id', () => {
    const a = res('A', { grade: 28, updatedAt: 1 })
    const b = res('A', { outcome: 'rifiutato', updatedAt: 2 })
    expect(courseStatus('A', [a, b]).kind).toBe('aperto')
    expect(courseStatus('A', [{ ...a, updatedAt: 3 }, b]).kind).toBe('superato')
  })
  it('ignores unusable rows and unknown courses', () => {
    const bad = [res('A', { grade: 17 }), res('A', { outcome: 'boh' as never }), res('A', { grade: 25.5 }), res('Z', { grade: 30 })]
    expect(courseStatus('A', bad).kind).toBe('aperto')
    expect(gradedEntries(COURSES, bad, P30)).toEqual([])
    expect(passedRows(COURSES, bad)).toEqual([])
  })
  it('passedRows sorted by date desc, attemptRows include earlier attempts of passed courses', () => {
    const r = [
      res('A', { outcome: 'rifiutato', date: '2026-01-01' }),
      res('A', { grade: 30, date: '2026-02-01' }),
      res('B', { grade: 27, date: '2026-03-01' }),
    ]
    expect(passedRows(COURSES, r).map((x) => x.course.id)).toEqual(['B', 'A'])
    expect(attemptRows(COURSES, r)).toHaveLength(1)
  })
  it('does not mutate and skips deleted courses', () => {
    const r = W1()
    const copy = JSON.stringify(r)
    activeCourses([...COURSES, course('H', 3, { deletedAt: 1 })], r)
    expect(JSON.stringify(r)).toBe(copy)
    expect(activeCourses([course('H', 3, { deletedAt: 1 })], r)).toEqual([])
  })
})

describe('graduation', () => {
  it('base', () => {
    near(graduationBase(27, 0, DEFAULT_FORMULA)!.total, 99)
    near(graduationBase(30, 0, DEFAULT_FORMULA)!.total, 110)
    near(graduationBase(738 / 27, 1, DEFAULT_FORMULA)!.total, 100.2222222)
    expect(graduationBase(null, 0, DEFAULT_FORMULA)).toBeNull()
    expect(graduationBase(27, 0, { ...DEFAULT_FORMULA, divisor: 0 })).toBeNull()
  })
  it('bonuses', () => {
    const f: GraduationFormula = {
      scale: 110,
      divisor: 30,
      bonuses: [
        { id: 'a', label: 'A', kind: 'fixed', points: 2 },
        { id: 'b', label: 'B', kind: 'perLode', points: 0.5 },
      ],
    }
    const b = graduationBase(738 / 27, 1, f)!
    expect(b.parts.map((p) => p.points)).toEqual([2, 0.5])
    near(b.bonus, 2.5)
    near(b.total, 102.7222222)
    near(graduationBase(774 / 27, 1, f)!.total, 107.6111111)
    expect(graduationBase(27, 0, f)!.parts[1]!.points).toBe(0)
    near(graduationBase(27, 0, { scale: 100, divisor: 30, bonuses: [] })!.total, 90)
    near(graduationBase(30, 0, { ...DEFAULT_FORMULA, bonuses: [{ id: 'x', label: '', kind: 'fixed', points: 2.5 }] })!.total, 112.5)
    near(graduationBase(27, 0, { ...DEFAULT_FORMULA, bonuses: [{ id: 'x', label: '', kind: 'fixed', points: -1 }] })!.total, 98)
  })
  it('normalizeFormula', () => {
    expect(normalizeFormula(null)).toEqual(DEFAULT_FORMULA)
    expect(normalizeFormula({ scale: 0, divisor: 'x' })).toEqual(DEFAULT_FORMULA)
    const f = normalizeFormula({ scale: 100, bonuses: [{ id: 'a', label: '  hi  ', kind: 'perLode', points: 1.234 }, { id: 'a', kind: 'zz', points: 999 }, 5, { points: NaN }] })
    expect(f.scale).toBe(100)
    expect(f.bonuses.map((b) => b.id)).toEqual(['a', 'a-2', 'b2'])
    expect(f.bonuses[0]).toMatchObject({ label: 'hi', kind: 'perLode', points: 1.23 })
    expect(f.bonuses[1]).toMatchObject({ kind: 'fixed', points: 100 })
    expect(normalizeFormula({ bonuses: Array.from({ length: 12 }, () => ({})) }).bonuses).toHaveLength(8)
  })
})

describe('requiredAverage', () => {
  const base = { points: 738, weights: 27, remainingCfu: 27 }
  const rounded = (x: ReturnType<typeof requiredAverage>) => (x as { neededRounded: number }).neededRounded
  it('worked examples', () => {
    const p28 = requiredAverage({ ...base, target: 28 }) as { kind: 'possible'; needed: number; neededRounded: number }
    expect(p28.kind).toBe('possible')
    near(p28.needed, 28.6666667)
    expect(p28.neededRounded).toBe(28.7)
    const imp = requiredAverage({ ...base, target: 29 })
    expect(imp.kind).toBe('impossible')
    near((imp as { best: number }).best, 28.6666667)
    expect(rounded(requiredAverage({ ...base, target: 26 }))).toBe(24.7)
    expect(requiredAverage({ ...base, target: 20 }).kind).toBe('reached')
    const s = { points: 738, weights: 27, remainingCfu: 30 }
    expect(rounded(requiredAverage({ ...s, target: 28 }))).toBe(28.6)
    expect(requiredAverage({ ...s, target: 30 }).kind).toBe('impossible')
    expect(rounded(requiredAverage({ ...s, target: 26 }))).toBe(24.8)
    expect(requiredAverage({ ...s, target: 20 }).kind).toBe('reached')
  })
  it('rounding and boundaries', () => {
    const z = { points: 0, weights: 0, remainingCfu: 10 }
    expect(rounded(requiredAverage({ ...z, target: 25.55 }))).toBe(25.6)
    expect(requiredAverage({ ...z, target: 18 }).kind).toBe('reached')
    expect(rounded(requiredAverage({ ...z, target: 18.01 }))).toBe(18.1)
    expect(rounded(requiredAverage({ ...z, target: 30 }))).toBe(30)
    expect(requiredAverage({ ...z, target: 30.01 })).toEqual({ kind: 'impossible', best: 30 })
    expect(rounded(requiredAverage({ ...z, target: 28.6 }))).toBe(28.6)
  })
  it('R = 0 and invalid input', () => {
    expect(requiredAverage({ points: 738, weights: 27, remainingCfu: 0, target: 27 }).kind).toBe('reached')
    near((requiredAverage({ points: 738, weights: 27, remainingCfu: 0, target: 28 }) as { best: number }).best, 738 / 27)
    expect(requiredAverage({ points: 0, weights: 0, remainingCfu: 0, target: 24 })).toEqual({ kind: 'impossible', best: null })
    expect(requiredAverage({ ...base, target: NaN })).toEqual({ kind: 'impossible', best: null })
  })
})

describe('gradebook', () => {
  it('composes', () => {
    const g = buildGradebook({ courses: COURSES, results: W1(), profile: P30, formula: DEFAULT_FORMULA, target: 28 })
    near(g.weighted, 738 / 27)
    expect(g.gradedCount).toBe(3)
    expect(g.gradedWithoutCfu).toBe(0)
    expect(g.remaining).toEqual({ exams: 3, cfu: 27 })
    expect(g.required.kind).toBe('possible')
    near(g.base!.total, 100.2222222)
    expect(remainingExams(COURSES, W1())).toEqual({ exams: 3, cfu: 27 })
  })
})

describe('draft', () => {
  const ids = new Set(['A'])
  const ok = { courseId: 'A', date: '2026-06-01', outcome: 'superato' as const, grade: 27 }
  it('validates', () => {
    expect(validateResultDraft(ok, ids)).toBeNull()
    expect(validateResultDraft({ ...ok, courseId: '' }, ids)).toEqual({ course: 'required' })
    expect(validateResultDraft({ ...ok, courseId: 'Z' }, ids)).toEqual({ course: 'invalid' })
    expect(validateResultDraft({ ...ok, date: '' }, ids)).toEqual({ date: 'required' })
    expect(validateResultDraft({ ...ok, date: '2026-06' }, ids)).toEqual({ date: 'invalid' })
    expect(validateResultDraft({ ...ok, date: '2026-02-30' }, ids)).toEqual({ date: 'invalid' })
    expect(validateResultDraft({ ...ok, grade: 31 }, ids)).toEqual({ grade: 'range' })
    expect(validateResultDraft({ ...ok, grade: 17 }, ids)).toEqual({ grade: 'range' })
    expect(validateResultDraft({ ...ok, grade: 25.5 }, ids)).toEqual({ grade: 'invalid' })
    expect(validateResultDraft({ ...ok, grade: null }, ids)).toBeNull()
    expect(validateResultDraft({ ...ok, lode: true }, ids)).toEqual({ grade: 'lodeNeeds30' })
    expect(validateResultDraft({ ...ok, grade: 30, lode: true }, ids)).toBeNull()
    expect(validateResultDraft({ ...ok, grade: null, lode: true }, ids)).toEqual({ grade: 'lodeNeeds30' })
    expect(validateResultDraft({ ...ok, outcome: 'rifiutato', grade: 99, lode: true }, ids)).toBeNull()
  })
  it('canonical', () => {
    expect(canonicalResult({ ...ok, lode: true })).toEqual({ courseId: 'A', date: '2026-06-01', outcome: 'superato', grade: 27 })
    expect(canonicalResult({ ...ok, grade: 30, lode: true })).toMatchObject({ grade: 30, lode: true })
    expect(canonicalResult({ ...ok, grade: null })).toEqual({ courseId: 'A', date: '2026-06-01', outcome: 'superato' })
    expect(canonicalResult({ ...ok, outcome: 'rifiutato' })).toEqual({ courseId: 'A', date: '2026-06-01', outcome: 'rifiutato' })
  })
  it('target average', () => {
    expect(normalizeTargetAverage('x')).toBe(28)
    expect(normalizeTargetAverage(40)).toBe(30)
    expect(normalizeTargetAverage(10)).toBe(18)
    expect(normalizeTargetAverage(27.26)).toBe(27.3)
  })
})

describe('simulatorMode', () => {
  it('without grades with credits it only asks for the first one', () => {
    const noResults = buildGradebook({ courses: COURSES, results: [], profile: P30, formula: DEFAULT_FORMULA, target: 28 })
    expect(noResults.remaining.cfu).toBeGreaterThan(0)
    expect(simulatorMode(noResults)).toBe('noData')
    expect(simulatorMode(buildGradebook({ courses: COURSES, results: W1(), profile: P30, formula: DEFAULT_FORMULA, target: 28 }))).toBe('sentence')
    expect(simulatorMode(buildGradebook({ courses: [], results: [], profile: P30, formula: DEFAULT_FORMULA, target: 28 }))).toBe('noExams')
    const all = COURSES.map((c) => res(c.id, { grade: 27 }))
    expect(simulatorMode(buildGradebook({ courses: COURSES, results: all, profile: P30, formula: DEFAULT_FORMULA, target: 28 }))).toBe('done')
  })
})
