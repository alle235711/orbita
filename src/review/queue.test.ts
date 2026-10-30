import { describe, expect, it } from 'vitest'
import type { Card, CardState } from '../db/schema'
import { FAKE_COURSES } from '../test/fixtures'
import { countByCourse, dailyQueue } from './queue'

const card = (id: string, courseId: string, section = 'A'): Card => ({
  id,
  courseId,
  section,
  kind: 'definizione',
  title: id,
  text: 'testo',
  key: 'testo',
  needsFix: false,
  userEdited: false,
  updatedAt: 0,
})
const state = (id: string, due: string, firstReviewed = '2026-10-01'): CardState => ({
  id,
  box: 2,
  due,
  firstReviewed,
  lastReviewed: firstReviewed,
  updatedAt: 1,
})

const cards = [
  ...Array.from({ length: 30 }, (_, i) => card(`c-fis-${String(i + 1).padStart(3, '0')}`, 'c-fis', i < 10 ? 'A' : 'B')),
  ...Array.from({ length: 10 }, (_, i) => card(`as-${String(i + 1).padStart(3, '0')}`, 'c-ast')),
]
const base = { today: '2026-10-27', cards, courses: FAKE_COURSES, newPerDay: 15 }

describe('coda del giorno', () => {
  it('propone 15 schede nuove della materia con l’esame più vicino', () => {
    const q = dailyQueue({ ...base, states: [] })
    expect(q.urgentCourseId).toBe('c-fis')
    expect(q.fresh).toHaveLength(15)
    expect(q.fresh[0]?.id).toBe('c-fis-001')
    expect(q.due).toEqual([])
  })

  it('mette prima le scadute, dall’esame più vicino', () => {
    const states = [state('as-001', '2026-10-20'), state('c-fis-002', '2026-10-27'), state('c-fis-001', '2026-10-25'), state('c-fis-003', '2026-10-28')]
    const q = dailyQueue({ ...base, states })
    expect(q.due.map((c) => c.id)).toEqual(['c-fis-001', 'c-fis-002', 'as-001'])
    expect(countByCourse(q.due)).toEqual({ 'c-fis': 2, 'c-ast': 1 })
  })

  it('conta nel limite le nuove già iniziate oggi', () => {
    const states = Array.from({ length: 10 }, (_, i) => state(`c-fis-${String(i + 1).padStart(3, '0')}`, '2026-10-28', '2026-10-27'))
    expect(dailyQueue({ ...base, states }).fresh).toHaveLength(5)
    expect(dailyQueue({ ...base, states, newPerDay: 8 }).fresh).toHaveLength(0)
  })

  it('filtra per materia e sezione', () => {
    const q = dailyQueue({ ...base, states: [] }, { courseId: 'c-ast' })
    expect(q.fresh.every((c) => c.courseId === 'c-ast')).toBe(true)
    expect(dailyQueue({ ...base, states: [] }, { courseId: 'c-fis', section: 'A' }).fresh).toHaveLength(10)
  })

  it('passato l’esame la materia scende in fondo', () => {
    const q = dailyQueue({ ...base, today: '2026-11-20', states: [] })
    expect(q.urgentCourseId).toBe('c-ast')
  })
})
