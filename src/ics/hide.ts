// Nascondere le lezioni di un corso: è un filtro di vista, non cancella niente.

import type { CalendarEvent, Course } from '../db/schema'

export function hiddenCourseIds(courses: Course[]): Set<string> {
  return new Set(courses.filter((c) => !c.deletedAt && c.hideLessons === true).map((c) => c.id))
}

export function isHiddenLesson(e: CalendarEvent, hidden: ReadonlySet<string>): boolean {
  return e.type === 'lezione' && !!e.courseId && hidden.has(e.courseId)
}

export function withoutHiddenLessons(events: CalendarEvent[], courses: Course[]): CalendarEvent[] {
  const hidden = hiddenCourseIds(courses)
  return hidden.size ? events.filter((e) => !isHiddenLesson(e, hidden)) : events
}
