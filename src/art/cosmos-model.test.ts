import { describe, expect, it } from 'vitest'
import type { Course, ExamResult } from '../db/schema'
import { COSMOS_WIDE } from './celestial'
import { composeCosmos } from './cosmos-model'

const TODAY = '2026-10-28'
const course = (id: string, examDate?: string): Course => ({ id, name: `Corso ${id}`, sections: [], difficulty: 2, semester: 1, examDate, updatedAt: 0 })
const res = (id: string, courseId: string, date: string, outcome: ExamResult['outcome'], extra: Partial<ExamResult> = {}): ExamResult => ({ id, courseId, date, outcome, updatedAt: 1, ...extra })
const compose = (courses: Course[], results: ExamResult[], pending: { resultId: string; courseId: string }[] = []) =>
  composeCosmos({ courses, results, today: TODAY, layout: COSMOS_WIDE, pending })

describe('composeCosmos', () => {
  const courses = [course('a', '2026-11-10'), course('b', '2026-12-05'), course('c'), course('d', '2027-01'), course('p', '2026-12-20'), course('m1'), course('m2')]
  const results = [
    res('r1', 'm1', '2026-09-01', 'superato', { grade: 27 }),
    res('r2', 'm2', '2026-10-01', 'superato', { grade: 30, lode: true }),
    res('r3', 'p', '2026-10-15', 'rifiutato'),
  ]

  it('stati → elementi', () => {
    const m = compose(courses, results)
    expect(m.comets.map((c) => c.courseId).sort()).toEqual(['a', 'b', 'd', 'p'])
    expect(m.comets.find((c) => c.courseId === 'p')!.periodic).toBe(true)
    expect(m.comets.find((c) => c.courseId === 'a')!.days).toBe(13)
    expect(m.moons.map((x) => x.courseId).sort()).toEqual(['m1', 'm2'])
    expect(m.moons.find((x) => x.courseId === 'm2')!.lode).toBe(true)
    expect(m.moons.find((x) => x.courseId === 'm1')!.resultId).toBe('r1')
    expect(m.captures).toEqual([])
    expect(m.stale).toEqual([])
  })

  it('elenchi: comete per data crescente, lune per data decrescente', () => {
    const m = compose(courses, results)
    expect(m.list.comets.map((c) => c.courseId)).toEqual(['a', 'b', 'p', 'd'])
    expect(m.list.moons.map((x) => x.courseId)).toEqual(['m2', 'm1'])
  })

  it('elenchi senza limiti anche oltre maxComets', () => {
    const many = Array.from({ length: 15 }, (_, i) => course(`x${i}`, `2026-11-${String(i + 1).padStart(2, '0')}`))
    const m = compose(many, [])
    expect(m.comets).toHaveLength(COSMOS_WIDE.comets.maxComets)
    expect(m.list.comets).toHaveLength(15)
  })

  it('una periodica senza data va in fondo all’elenco', () => {
    const m = compose([course('p'), course('q', '2026-11-30')], [res('r', 'p', '2026-10-15', 'rifiutato'), res('s', 'q', '2026-10-01', 'non-superato')])
    expect(m.list.comets.map((c) => c.courseId)).toEqual(['q', 'p'])
  })

  it('cattura valida: la cometa tiene il suo posto e la luna è presente ma capturing', () => {
    const before = compose([course('z', '2026-11-20'), course('y', '2026-12-10')], [])
    const slot = before.comets.find((c) => c.courseId === 'z')!
    const m = compose([course('z', '2026-11-20'), course('y', '2026-12-10')], [res('rz', 'z', TODAY, 'superato', { grade: 28 })], [{ resultId: 'rz', courseId: 'z' }])
    expect(m.stale).toEqual([])
    expect(m.comets.map((c) => c.courseId)).toEqual(['y'])
    expect(m.captures).toHaveLength(1)
    const cap = m.captures[0]!
    expect(cap.name).toBe('Corso z')
    expect(cap.moon.id).toBe('z')
    expect(m.moons.find((x) => x.courseId === 'z')!.capturing).toBe(true)
    // parte dall'angolo di prima (stesso insieme di id) e dal raggio più vicino perché la data è passata o a 0 giorni
    const angle = (((Math.atan2(cap.from.y - COSMOS_WIDE.comets.centre.y, cap.from.x - COSMOS_WIDE.comets.centre.x) * 180) / Math.PI) + 360) % 360
    expect(Math.abs(angle - slot.angle)).toBeLessThan(1e-6)
  })

  it('in sospeso non validi: sconosciuto, non è un voto, superato da un tentativo successivo, risultato diverso', () => {
    const cs = [course('k', '2026-12-01'), course('j'), course('h')]
    const rs = [
      res('old', 'j', '2026-09-01', 'superato', { grade: 22 }),
      res('later', 'j', '2026-10-01', 'rifiutato'),
      res('good', 'h', '2026-10-02', 'superato', { grade: 25 }),
    ]
    const m = compose(cs, rs, [
      { resultId: 'nope', courseId: 'ghost' },
      { resultId: 'rk', courseId: 'k' },
      { resultId: 'old', courseId: 'j' },
      { resultId: 'other', courseId: 'h' },
      { resultId: 'good', courseId: 'h' },
      { resultId: 'good', courseId: 'h' },
    ])
    expect(m.stale.sort()).toEqual(['nope', 'old', 'other', 'rk'])
    expect(m.captures.map((c) => c.resultId)).toEqual(['good'])
  })

  it('al massimo 3 catture, le altre vanno in stale', () => {
    const cs = ['a', 'b', 'c', 'd'].map((id) => course(id))
    const rs = cs.map((c) => res(`r${c.id}`, c.id, TODAY, 'superato', { grade: 20 }))
    const m = compose(cs, rs, cs.map((c) => ({ resultId: `r${c.id}`, courseId: c.id })))
    expect(m.captures).toHaveLength(3)
    expect(m.stale).toEqual(['rd'])
  })

  it('non muta gli ingressi ed è deterministico', () => {
    const snapshot = JSON.stringify([courses, results])
    const a = compose(courses, results)
    const b = compose(courses, results)
    expect(a).toEqual(b)
    expect(JSON.stringify([courses, results])).toBe(snapshot)
  })
})
