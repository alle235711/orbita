import { describe, expect, it } from 'vitest'
import type { Appello, Course, Deadline } from '../db/schema'
import { DEFAULT_FORMULA, DEFAULT_GRADE_PROFILE } from '../libretto/grades'
import { evaluateUniverse } from './scenario'
import { buildSky, headRadiusFor, sharedScale, SKY_LAYOUT, starPoints, validateSkyLayout, warnArcPath } from './sky'

const TODAY = '2026-11-02'
const course = (id: string, cfu = 6): Course => ({ id, name: `Esame ${id}`, sections: [], difficulty: 2, cfu, updatedAt: 0 })

function build(dates: Record<string, string>, ids = Object.keys(dates), periods: Deadline[] = [], gap = 60) {
  const courses = ids.map((id) => course(id))
  const appelli: Appello[] = Object.entries(dates).map(([c, d]) => ({ id: `s-${c}`, courseId: c, date: d, updatedAt: 0 }))
  const picks = Object.fromEntries(Object.keys(dates).map((c) => [c, `s-${c}`]))
  const evaluation = evaluateUniverse({ universe: { id: 'u', picks, grades: {} }, courses, results: [], appelli, periods, today: TODAY, params: { closeDays: 5, finalGapDays: gap }, profile: DEFAULT_GRADE_PROFILE, formula: DEFAULT_FORMULA })
  const scale = sharedScale([evaluation], TODAY)
  return { evaluation, scale, sky: buildSky({ evaluation, periods, allExamIds: ids, today: TODAY, scale, layout: SKY_LAYOUT }) }
}

describe('layout and helpers', () => {
  it('SKY_LAYOUT is valid', () => expect(validateSkyLayout(SKY_LAYOUT)).toEqual([]))
  it('validateSkyLayout catches a broken layout', () => {
    expect(validateSkyLayout({ ...SKY_LAYOUT, comets: { ...SKY_LAYOUT.comets, rMax: 400 } }).length).toBeGreaterThan(0)
    expect(validateSkyLayout({ ...SKY_LAYOUT, comets: { ...SKY_LAYOUT.comets, sector: [200, 100] } })).toContain('sector')
  })
  it('warnArcPath worked example', () => expect(warnArcPath({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 })).toBe('M 0,0 Q 50,-35 100,0'))
  it('starPoints', () => {
    const pts = starPoints(0, 0, 10).split(' ')
    expect(pts).toHaveLength(10)
    expect(pts[0]).toBe('0,-10')
    const [x, y] = pts[1]!.split(',').map(Number)
    expect(Math.hypot(x!, y!)).toBeCloseTo(4.5, 2)
  })
  it('headRadiusFor', () => {
    const h = SKY_LAYOUT.comets.headRadius
    expect(headRadiusFor(15, SKY_LAYOUT)).toBeCloseTo(h * 1.5, 9)
    expect(headRadiusFor(3, SKY_LAYOUT)).toBeCloseTo(h * 0.8, 9)
    expect(headRadiusFor(undefined, SKY_LAYOUT)).toBeCloseTo(h * 0.8, 9)
    expect(headRadiusFor(9, SKY_LAYOUT)).toBeCloseTo(h * 1.15, 9)
  })
  it('sharedScale', () => {
    expect(build({ a: '2026-11-11' }).scale).toEqual({ horizonDays: 69, weeks: 11, maxCfu: 4.2 })
    expect(sharedScale([], TODAY)).toEqual({ horizonDays: 60, weeks: 10, maxCfu: 1 })
  })
})

describe('buildSky', () => {
  it('same course, same angle in every universe', () => {
    const ids = ['a', 'b', 'c']
    const one = build({ a: '2026-11-10', b: '2026-11-30', c: '2026-12-20' }, ids).sky
    const two = build({ a: '2026-12-10', c: '2026-11-15' }, ids).sky
    for (const c of two.comets) expect(c.angle).toBeCloseTo(one.comets.find((x) => x.courseId === c.courseId)!.angle, 9)
    expect(two.comets.map((c) => c.courseId).sort()).toEqual(['a', 'c'])
  })
  it('closer exam sits nearer the hole', () => {
    const { sky } = build({ a: '2026-11-05', b: '2026-12-20' })
    const d = (c: { x: number; y: number }) => Math.hypot(c.x - SKY_LAYOUT.centre.x, c.y - SKY_LAYOUT.centre.y)
    expect(d(sky.comets.find((c) => c.courseId === 'a')!)).toBeLessThan(d(sky.comets.find((c) => c.courseId === 'b')!))
  })
  it('arcs, month ranges, star and bands', () => {
    const period: Deadline = { id: 'p', title: 'Stage Fittizio', kind: 'periodo', date: '2026-11-20', endDate: '2026-12-05', updatedAt: 0 }
    const { sky } = build({ a: '2026-11-10', b: '2026-11-12', c: '2026-12' }, undefined, [period])
    expect(sky.arcs).toHaveLength(1)
    expect(sky.arcs[0]!.d.startsWith('M ')).toBe(true)
    const c = sky.comets.find((x) => x.courseId === 'c')!
    expect(c.monthOnly).toBe(true)
    expect(c.range).not.toBeNull()
    expect(c.period).toBe('uncertain')
    expect(sky.comets.find((x) => x.courseId === 'a')!.close).toBe(true)
    expect(sky.star?.range).not.toBeNull()
    expect(sky.star?.provisional).toBe(false)
    expect(sky.bands).toHaveLength(1)
    expect(sky.bands[0]!.rOuter - sky.bands[0]!.rInner).toBeGreaterThanOrEqual(2)
    expect(sky.bands[0]!.conflict).toBe(true)
    expect(sky.strip.curve.startsWith('M ')).toBe(true)
    expect(sky.strip.exams).toHaveLength(3)
    expect(sky.strip.star).not.toBeNull()
  })
  it('an empty universe has empty arrays and no NaN', () => {
    const { sky } = build({}, ['a', 'b'])
    expect(sky).toMatchObject({ comets: [], arcs: [], bands: [], star: null, hidden: 0 })
    expect(sky.strip).toMatchObject({ curve: '', area: '', peak: null, star: null })
  })
  it('no NaN anywhere and the star stays inside the viewBox', () => {
    const { sky } = build({ a: '2026-11-02', b: '2027-09-01' }, undefined, [], 365)
    expect(JSON.stringify(sky)).not.toMatch(/NaN|Infinity/)
    expect(sky.star!.y).toBeGreaterThan(0)
    for (const c of sky.comets) {
      expect(c.y).toBeGreaterThan(0)
      expect(c.y).toBeLessThan(SKY_LAYOUT.height)
      expect(c.x).toBeGreaterThan(0)
    }
  })
  it('hides comets beyond the maximum but keeps the count', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `e${i}`)
    const dates = Object.fromEntries(ids.map((id, i) => [id, `2026-11-${String(5 + i * 2).padStart(2, '0')}`]))
    const { sky } = build(dates, ids)
    expect(sky.comets).toHaveLength(SKY_LAYOUT.comets.maxComets)
    expect(sky.hidden).toBe(2)
  })
})
