// Coda del giorno per il ripasso (SPEC §3.5): prima le schede scadute, a
// partire dalla materia con l'esame più vicino, poi un numero configurabile
// di schede nuove per la materia urgente (15 al giorno di predefinito).

import type { Card, CardState, Course } from '../db/schema'
import type { ISODate } from '../lib/dates'
import { examsAhead } from '../rules/rules'

export interface QueueInput {
  today: ISODate
  cards: Card[]
  states: CardState[]
  courses: Course[]
  newPerDay: number
}

export interface QueueFilter {
  courseId?: string
  section?: string
}

export interface DailyQueue {
  due: Card[]
  fresh: Card[]
  /** La materia da cui arrivano le schede nuove. */
  urgentCourseId?: string
}

const byId = (a: Card, b: Card) => a.id.localeCompare(b.id, 'it', { numeric: true })

/** Ordine delle materie: esame più vicino prima, quelle senza esame in coda. */
export function courseRank(courses: Course[], today: ISODate): (courseId: string) => number {
  const order = examsAhead(courses, today).map((e) => e.course.id)
  return (id) => {
    const i = order.indexOf(id)
    return i < 0 ? order.length : i
  }
}

export function dailyQueue(input: QueueInput, filter: QueueFilter = {}): DailyQueue {
  const { today, newPerDay } = input
  const matches = (c: Card) =>
    !c.deletedAt && (!filter.courseId || c.courseId === filter.courseId) && (!filter.section || c.section === filter.section)
  const cards = input.cards.filter(matches)
  const states = new Map(input.states.filter((s) => !s.deletedAt).map((s) => [s.id, s]))
  const rank = courseRank(input.courses, today)

  const due = cards
    .filter((c) => {
      const s = states.get(c.id)
      return !!s && s.due <= today
    })
    .sort((a, b) => rank(a.courseId) - rank(b.courseId) || states.get(a.id)!.due.localeCompare(states.get(b.id)!.due) || byId(a, b))

  const unseen = cards.filter((c) => !states.has(c.id))
  const urgentCourseId =
    filter.courseId ?? [...new Set(unseen.map((c) => c.courseId))].sort((a, b) => rank(a) - rank(b))[0]
  if (!urgentCourseId) return { due, fresh: [] }

  // Le nuove già iniziate oggi contano nel limite del giorno.
  const startedToday = input.cards.filter(
    (c) => c.courseId === urgentCourseId && states.get(c.id)?.firstReviewed === today,
  ).length
  const room = Math.max(0, newPerDay - startedToday)
  const fresh = unseen.filter((c) => c.courseId === urgentCourseId).sort(byId).slice(0, room)
  return { due, fresh, urgentCourseId }
}

export function countByCourse(cards: Card[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of cards) out[c.courseId] = (out[c.courseId] ?? 0) + 1
  return out
}
