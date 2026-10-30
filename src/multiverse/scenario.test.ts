import { describe, expect, it } from 'vitest'
import type { Appello, Course, Deadline, ExamResult } from '../db/schema'
import { DEFAULT_FORMULA, DEFAULT_GRADE_PROFILE } from '../libretto/grades'
import { applyUniverse, compareUniverses, evaluateUniverse, examSet, normalizeMultiverse, sittingInfo, sittingsOf, suggestPicks, type EvaluateInput, type UniverseEvaluation } from './scenario'

const TODAY = '2026-11-02'
const PARAMS = { closeDays: 5, finalGapDays: 60 }

const course = (id: string, cfu: number | undefined, extra: Partial<Course> = {}): Course => ({ id, name: `Esame ${id}`, sections: [], difficulty: 2, cfu, updatedAt: 0, ...extra })
const sitting = (id: string, courseId: string, date: string): Appello => ({ id, courseId, date, updatedAt: 0 })
const pass = (courseId: string, grade: number, lode = false): ExamResult => ({ id: `r-${courseId}`, courseId, date: '2026-06-01', outcome: 'superato', grade, ...(lode ? { lode } : {}), updatedAt: 0 })

function evalWith(over: Partial<EvaluateInput> & { courses: Course[]; appelli: Appello[]; picks: Record<string, string> }) {
  const { picks, universe, ...rest } = over
  return evaluateUniverse({
    results: [],
    periods: [],
    today: TODAY,
    params: PARAMS,
    profile: DEFAULT_GRADE_PROFILE,
    formula: DEFAULT_FORMULA,
    ...rest,
    universe: { id: 'u', picks, grades: universe?.grades ?? {} },
  })
}

/** Due esami con le date date (cfu 6 l'uno): per le prove sulla distanza. */
function pairGap(a: string, b: string, params = PARAMS) {
  const courses = [course('a', 6), course('b', 6)]
  const appelli = [sitting('sa', 'a', a), sitting('sb', 'b', b)]
  return evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb' }, params }).tooClose
}

describe('sittingInfo', () => {
  it('full date and month-only', () => {
    expect(sittingInfo(sitting('s', 'a', '2026-11-13'), TODAY)).toMatchObject({ monthOnly: false, lo: '2026-11-13', hi: '2026-11-13', resolved: '2026-11-13', expired: false })
    expect(sittingInfo(sitting('s', 'a', '2026-12'), TODAY)).toMatchObject({ monthOnly: true, lo: '2026-12-01', hi: '2026-12-31', resolved: '2026-12-15', expired: false })
    expect(sittingInfo(sitting('s', 'a', '2026-11'), TODAY)).toMatchObject({ lo: '2026-11-02', hi: '2026-11-30', resolved: '2026-11-15' })
    expect(sittingInfo(sitting('s', 'a', '2026-12'), '2026-12-28')).toMatchObject({ lo: '2026-12-28', resolved: '2026-12-28' })
  })
  it('today is not expired, yesterday is', () => {
    expect(sittingInfo(sitting('s', 'a', TODAY), TODAY)?.expired).toBe(false)
    expect(sittingInfo(sitting('s', 'a', '2026-11-01'), TODAY)?.expired).toBe(true)
    expect(sittingInfo(sitting('s', 'a', '2026-10'), TODAY)?.expired).toBe(true)
  })
  it('null for bad or deleted rows', () => {
    expect(sittingInfo(sitting('s', 'a', '2026-02-30'), TODAY)).toBeNull()
    expect(sittingInfo(sitting('s', 'a', '2026-13'), TODAY)).toBeNull()
    expect(sittingInfo(sitting('s', 'a', 'domani'), TODAY)).toBeNull()
    expect(sittingInfo({ ...sitting('s', 'a', '2026-11-13'), deletedAt: 5 }, TODAY)).toBeNull()
  })
  it('sittingsOf sorts by resolved then id', () => {
    const list = [sitting('z', 'a', '2026-11-20'), sitting('b', 'a', '2026-11-10'), sitting('a', 'a', '2026-11-10'), sitting('x', 'o', '2026-11-01')]
    expect(sittingsOf('a', list, TODAY).map((s) => s.id)).toEqual(['a', 'b', 'z'])
  })
})

describe('exam set and suggestions', () => {
  const courses = [course('a', 6), course('b', 6), course('c', 6), course('d', 6)]
  const appelli = [sitting('a1', 'a', '2026-11-10'), sitting('a2', 'a', '2026-11-20'), sitting('b1', 'b', '2026-10-01'), sitting('c0', 'c', '2026-11-30')]
  const results = [pass('d', 27)]
  it('examSet keeps active courses with a usable sitting, even expired', () => {
    expect(examSet([...courses, course('e', 3)], results, [...appelli, sitting('d1', 'd', '2026-12-01')], TODAY).map((c) => c.id)).toEqual(['a', 'b', 'c'])
  })
  it('a failed exam is still in the set', () => {
    const failed: ExamResult = { id: 'f', courseId: 'd', date: '2026-06-01', outcome: 'rifiutato', updatedAt: 0 }
    expect(examSet(courses, [failed], [sitting('d1', 'd', '2026-12-01')], TODAY).map((c) => c.id)).toEqual(['d'])
  })
  it('suggestPicks uses the index-th non-expired sitting, clamped', () => {
    expect(suggestPicks(courses, results, appelli, TODAY, 0)).toEqual({ a: 'a1', c: 'c0' })
    expect(suggestPicks(courses, results, appelli, TODAY, 1)).toEqual({ a: 'a2', c: 'c0' })
    expect(suggestPicks(courses, results, appelli, TODAY, 9)).toEqual({ a: 'a2', c: 'c0' })
  })
})

describe('weekly load', () => {
  const courses = [course('a', 12), course('b', 6), course('c', 9)]
  const appelli = [sitting('sa', 'a', '2026-11-13'), sitting('sb', 'b', '2026-11-17'), sitting('sc', 'c', '2026-12')]
  const ev = evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb', c: 'sc' } })
  it('reproduces the worked example', () => {
    expect(ev.weeklyLoad.map((w) => w.week)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'])
    const want = [7, 8, 4.6071429, 2.25, 2.25, 2.25, 0.6428571]
    ev.weeklyLoad.forEach((w, i) => expect(w.cfu).toBeCloseTo(want[i]!, 6))
    expect(ev.totalCfu).toBe(27)
    expect(ev.weeklyLoad.reduce((s, w) => s + w.cfu, 0)).toBeCloseTo(27, 9)
    expect(ev.peak).toEqual({ week: '2026-11-09', cfu: 8 })
  })
  it('same-day exams share a week', () => {
    const e = evalWith({ courses: [course('x', 4), course('y', 6)], appelli: [sitting('sx', 'x', TODAY), sitting('sy', 'y', TODAY)], picks: { x: 'sx', y: 'sy' } })
    expect(e.weeklyLoad).toHaveLength(1)
    expect(e.weeklyLoad[0]!.cfu).toBeCloseTo(10, 9)
  })
  it('an exam without cfu adds nothing but counts as unknown', () => {
    const e = evalWith({ courses: [course('x', undefined), course('y', 6)], appelli: [sitting('sx', 'x', '2026-11-05'), sitting('sy', 'y', '2026-11-10')], picks: { x: 'sx', y: 'sy' } })
    expect(e.unknownCfu).toBe(1)
    expect(e.totalCfu).toBe(6)
    expect(e.weeklyLoad.reduce((s, w) => s + w.cfu, 0)).toBeCloseTo(6, 9)
  })
  it('no exam gives empty load and null graduation', () => {
    const e = evalWith({ courses, appelli, picks: {} })
    expect(e.weeklyLoad).toEqual([])
    expect(e.peak).toBeNull()
    expect(e.graduationDate).toBeNull()
    expect(e.complete).toBe(false)
    expect(e.missingPicks).toEqual(['a', 'b', 'c'])
  })
})

describe('too close (inclusive threshold)', () => {
  it('k = 5: 4 and 5 days are close, 6 is not, 0 is close', () => {
    expect(pairGap('2026-11-13', '2026-11-17')).toHaveLength(1)
    expect(pairGap('2026-11-13', '2026-11-18')).toHaveLength(1)
    expect(pairGap('2026-11-13', '2026-11-19')).toHaveLength(0)
    expect(pairGap('2026-11-13', '2026-11-13')).toHaveLength(1)
    expect(pairGap('2026-11-13', '2026-11-17')[0]).toMatchObject({ gap: 4, uncertain: false })
  })
  it('k = 6 includes a 6-day gap, 7 is not', () => {
    expect(pairGap('2026-11-13', '2026-11-19', { closeDays: 6, finalGapDays: 60 })).toHaveLength(1)
    expect(pairGap('2026-11-13', '2026-11-20', { closeDays: 6, finalGapDays: 60 })).toHaveLength(0)
  })
  it('order does not matter: a is the earlier', () => {
    expect(pairGap('2026-11-17', '2026-11-13')[0]).toMatchObject({ a: 'b', b: 'a' })
  })
  it('month-only is uncertain', () => {
    const [p] = pairGap('2026-12-10', '2026-12')
    expect(p).toMatchObject({ minGap: 0, maxGap: 21, uncertain: true })
    expect(pairGap('2026-12-10', '2027-01')).toHaveLength(0)
  })
  it('month-only squeezed by today is certain', () => {
    const courses = [course('a', 6), course('b', 6)]
    const appelli = [sitting('sa', 'a', '2026-12'), sitting('sb', 'b', '2026-12-30')]
    const [p] = evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb' }, today: '2026-12-28' }).tooClose
    expect(p).toMatchObject({ minGap: 0, maxGap: 2, uncertain: false })
  })
  it('all pairs are examined and counts are split', () => {
    const courses = [course('a', 6), course('b', 6), course('c', 6)]
    const appelli = [sitting('sa', 'a', '2026-11-10'), sitting('sb', 'b', '2026-11-12'), sitting('sc', 'c', '2026-11-14')]
    const e = evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb', c: 'sc' } })
    expect(e.tooClose.map((p) => `${p.a}${p.b}`)).toEqual(['ab', 'ac', 'bc'])
    expect(e.counts).toEqual({ certain: 3, uncertain: 0 })
  })
})

describe('period conflicts', () => {
  const period: Deadline = { id: 'p', title: 'Stage Fittizio', kind: 'periodo', date: '2026-11-09', endDate: '2026-11-20', updatedAt: 0 }
  const one = (date: string, periods: Deadline[] = [period]) =>
    evalWith({ courses: [course('a', 6)], appelli: [sitting('s', 'a', date)], picks: { a: 's' }, periods }).periodConflicts
  it('inclusive ends', () => {
    expect(one('2026-11-09')).toHaveLength(1)
    expect(one('2026-11-20')).toHaveLength(1)
    expect(one('2026-11-08')).toHaveLength(0)
    expect(one('2026-11-21')).toHaveLength(0)
    expect(one('2026-11-09')[0]).toMatchObject({ periodId: 'p', periodName: 'Stage Fittizio', uncertain: false })
  })
  it('month-only partial overlap is uncertain, full cover is certain, no overlap is none', () => {
    expect(one('2026-11')[0]?.uncertain).toBe(true)
    expect(one('2026-12')).toHaveLength(0)
    expect(one('2026-11', [{ ...period, date: '2026-11-01', endDate: '2026-11-30' }])[0]?.uncertain).toBe(false)
  })
  it('ignores bad periods; two periods give two records', () => {
    expect(one('2026-11-10', [{ ...period, endDate: undefined }])).toHaveLength(0)
    expect(one('2026-11-10', [{ ...period, kind: 'scadenza' }])).toHaveLength(0)
    expect(one('2026-11-10', [{ ...period, deletedAt: 3 }])).toHaveLength(0)
    expect(one('2026-11-10', [period, { ...period, id: 'q' }])).toHaveLength(2)
  })
})

describe('graduation', () => {
  const courses = [course('a', 12), course('b', 6), course('c', 9)]
  const appelli = [sitting('sa', 'a', '2026-11-13'), sitting('sb', 'b', '2026-11-17'), sitting('sc', 'c', '2026-12')]
  it('last exam plus the final gap, with a range for a month', () => {
    const e = evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb', c: 'sc' }, params: { closeDays: 5, finalGapDays: 70 } })
    expect(e).toMatchObject({ graduationDate: '2027-02-23', graduationEarliest: '2027-02-09', graduationLatest: '2027-03-11', graduationUncertain: true })
    const f = evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb' } })
    expect(f).toMatchObject({ graduationDate: '2027-01-16', graduationEarliest: '2027-01-16', graduationLatest: '2027-01-16', graduationUncertain: false, complete: false })
    expect(evalWith({ courses, appelli, picks: { a: 'sa', b: 'sb' }, params: { closeDays: 5, finalGapDays: 0 } }).graduationDate).toBe('2026-11-17')
  })
  it('stale and expired picks count as missing', () => {
    const e = evalWith({ courses, appelli: [...appelli, sitting('old', 'a', '2026-10-01')], picks: { a: 'old', b: 'sa', c: 'sc', zzz: 'sc' } })
    expect(e.missingPicks).toEqual(['a', 'b'])
    expect(e.exams.map((x) => x.courseId)).toEqual(['c'])
  })
})

describe('expected average', () => {
  const past = [course('A', 12), course('B', 6), course('C', 9), course('D', undefined)]
  const results = [pass('A', 30, true), pass('B', 27), pass('C', 24), { id: 'rD', courseId: 'D', date: '2026-06-01', outcome: 'superato', updatedAt: 0 } as ExamResult]
  const open = [course('E', 12), course('F', 9), course('G', 6)]
  const courses = [...past, ...open]
  const appelli = [sitting('sE', 'E', '2026-11-20'), sitting('sF', 'F', '2026-12-01'), sitting('sG', 'G', '2026-12-10')]
  const base = { courses, results, appelli, picks: { E: 'sE', F: 'sF', G: 'sG' } }
  it('default grade keeps the current mean', () => {
    const e = evalWith(base)
    expect(e.expectedAverage).toBeCloseTo(27.3333333, 6)
    expect(e.expectedBase?.total).toBeCloseTo(100.2222222, 6)
    expect(e.exams[0]!.gradeSource).toBe('default')
  })
  it('overrides', () => {
    const run = (grades: Record<string, number>) => evaluateUniverse({ universe: { id: 'u', picks: base.picks, grades }, courses, results, appelli, periods: [], today: TODAY, params: PARAMS, profile: DEFAULT_GRADE_PROFILE, formula: DEFAULT_FORMULA })
    expect(run({ G: 30 }).expectedAverage).toBeCloseTo(27.6296296, 6)
    expect(run({ G: 30 }).expectedBase?.total).toBeCloseTo(101.308642, 5)
    expect(run({ E: 24, F: 26, G: 30 }).expectedAverage).toBeCloseTo(26.6666667, 6)
    expect(run({ G: 35 }).exams.find((x) => x.courseId === 'G')?.expectedGrade).toBe(30)
    expect(run({ G: 10 }).exams.find((x) => x.courseId === 'G')?.expectedGrade).toBe(18)
  })
  it('missing pick leaves the exam out; the lode bonus applies', () => {
    const e = evalWith({ ...base, picks: { E: 'sE', F: 'sF' }, universe: { id: 'u', picks: {}, grades: { E: 30 } } })
    expect(e.expectedAverage).toBeCloseTo((738 + 360 + 9 * (738 / 27)) / 48, 6)
    const f = evalWith({ ...base, formula: { scale: 110, divisor: 30, bonuses: [{ id: 'b', label: 'x', kind: 'perLode', points: 0.5 }] } })
    expect(f.expectedBase!.total - 100.2222222).toBeCloseTo(0.5, 6)
  })
  it('no past grade and no override gives null', () => {
    const e = evalWith({ courses: open, appelli, picks: base.picks })
    expect(e.expectedAverage).toBeNull()
    expect(e.expectedBase).toBeNull()
    expect(e.exams[0]!.gradeSource).toBe('none')
    const o = evalWith({ courses: open, appelli, picks: base.picks, universe: { id: 'u', picks: {}, grades: { E: 28 } } })
    expect(o.expectedAverage).toBe(28)
  })
  it('an exam without cfu is skipped', () => {
    const e = evalWith({ ...base, courses: [...past, course('E', undefined)], appelli: [sitting('sE', 'E', '2026-11-20')], picks: { E: 'sE' }, universe: { id: 'u', picks: {}, grades: { E: 18 } } })
    expect(e.expectedAverage).toBeCloseTo(27.3333333, 6)
    expect(e.unknownCfu).toBe(1)
  })
})

describe('compare and apply', () => {
  const ev = (id: string, date: string, certain: number, uncertain: number, peak: number, complete = true): UniverseEvaluation =>
    ({ universeId: id, complete, graduationDate: date, peak: { week: '2026-11-02', cfu: peak }, counts: { certain, uncertain } }) as UniverseEvaluation
  it('per-criterion winners, shared ties and non-discriminating criteria', () => {
    const c = compareUniverses([ev('u1', '2027-01-16', 1, 0, 12), ev('u2', '2027-02-01', 0, 2, 8), ev('u3', '2027-02-01', 0, 1, 8)])
    expect(c).toEqual({ earliestGraduation: ['u1'], fewestConflicts: ['u3'], lightestPeak: ['u2', 'u3'] })
  })
  it('incomplete universes never win and one candidate gives nothing', () => {
    const c = compareUniverses([ev('u1', '2027-01-16', 1, 0, 12), ev('u2', '2027-02-01', 0, 2, 8, false), ev('u3', '2027-02-01', 0, 1, 8)])
    expect(c.lightestPeak).toEqual(['u3'])
    expect(compareUniverses([ev('u1', '2027-01-16', 1, 0, 12), ev('u2', '2027-02-01', 0, 2, 8, false)])).toEqual({ earliestGraduation: [], fewestConflicts: [], lightestPeak: [] })
    expect(compareUniverses([ev('u1', '2027-01-16', 0, 0, 8), ev('u2', '2027-01-16', 0, 0, 8)])).toEqual({ earliestGraduation: [], fewestConflicts: [], lightestPeak: [] })
  })
  it('applyUniverse lists only the changed exams', () => {
    const courses = [course('E', 6, { examDate: '2026-11-13' }), course('F', 6), course('G', 6, { examDate: '2026-12-02' })]
    const appelli = [sitting('e', 'E', '2026-11-20'), sitting('f', 'F', '2026-12'), sitting('g', 'G', '2026-12-02')]
    const e = evalWith({ courses, appelli, picks: { E: 'e', F: 'f', G: 'g' } })
    expect(applyUniverse(e, courses)).toEqual([
      { courseId: 'E', name: 'Esame E', from: '2026-11-13', to: '2026-11-20' },
      { courseId: 'F', name: 'Esame F', from: undefined, to: '2026-12' },
    ])
  })
})

describe('normalizeMultiverse', () => {
  it('clamps, rounds and falls back', () => {
    expect(normalizeMultiverse({ closeDays: 0, finalGapDays: 999 })).toEqual({ closeDays: 1, finalGapDays: 365 })
    expect(normalizeMultiverse({ closeDays: 99, finalGapDays: -4 })).toEqual({ closeDays: 30, finalGapDays: 0 })
    expect(normalizeMultiverse({ closeDays: 4.6, finalGapDays: 10.4 })).toEqual({ closeDays: 5, finalGapDays: 10 })
    expect(normalizeMultiverse({ closeDays: 'x', finalGapDays: NaN })).toEqual({ closeDays: 5, finalGapDays: 60 })
    for (const raw of [undefined, null, 3, 'a', []]) expect(normalizeMultiverse(raw)).toEqual({ closeDays: 5, finalGapDays: 60 })
  })
})
