import { describe, expect, it } from 'vitest'
import type { Card, CardState } from '../db/schema'
import { SEED_COURSES } from '../db/seed'
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
  ...Array.from({ length: 30 }, (_, i) => card(`sdm-${String(i + 1).padStart(3, '0')}`, 'sdm', i < 10 ? 'A' : 'B')),
  ...Array.from({ length: 10 }, (_, i) => card(`as-${String(i + 1).padStart(3, '0')}`, 'astrost')),
]
const base = { today: '2026-10-27', cards, courses: SEED_COURSES, newPerDay: 15 }

describe('coda del giorno', () => {
  it('propone 15 schede nuove della materia con l’esame più vicino', () => {
    const q = dailyQueue({ ...base, states: [] })
    expect(q.urgentCourseId).toBe('sdm')
    expect(q.fresh).toHaveLength(15)
    expect(q.fresh[0]?.id).toBe('sdm-001')
    expect(q.due).toEqual([])
  })

  it('mette prima le scadute, dall’esame più vicino', () => {
    const states = [state('as-001', '2026-10-20'), state('sdm-002', '2026-10-27'), state('sdm-001', '2026-10-25'), state('sdm-003', '2026-10-28')]
    const q = dailyQueue({ ...base, states })
    expect(q.due.map((c) => c.id)).toEqual(['sdm-001', 'sdm-002', 'as-001'])
    expect(countByCourse(q.due)).toEqual({ sdm: 2, astrost: 1 })
  })

  it('conta nel limite le nuove già iniziate oggi', () => {
    const states = Array.from({ length: 10 }, (_, i) => state(`sdm-${String(i + 1).padStart(3, '0')}`, '2026-10-28', '2026-10-27'))
    expect(dailyQueue({ ...base, states }).fresh).toHaveLength(5)
    expect(dailyQueue({ ...base, states, newPerDay: 8 }).fresh).toHaveLength(0)
  })

  it('filtra per materia e sezione', () => {
    const q = dailyQueue({ ...base, states: [] }, { courseId: 'astrost' })
    expect(q.fresh.every((c) => c.courseId === 'astrost')).toBe(true)
    expect(dailyQueue({ ...base, states: [] }, { courseId: 'sdm', section: 'A' }).fresh).toHaveLength(10)
  })

  it('passato l’esame la materia scende in fondo', () => {
    const q = dailyQueue({ ...base, today: '2026-11-20', states: [] })
    expect(q.urgentCourseId).toBe('astrost')
  })
})
