// Dai titoli del file ai corsi dell'utente: si propone, non si decide. Il chiamante chiede sempre conferma.

import type { CalendarEvent, Course } from '../db/schema'
import type { ISODate } from '../lib/dates'
import { bestMatch, MATCH_THRESHOLD, normalizeName } from '../lib/match'
import type { IcsExpansion } from './expand'

export type IcsTarget = { kind: 'course'; courseId: string } | { kind: 'none' } | { kind: 'skip' }
/** Chiave = il titolo così com'è in IcsOccurrence.summary. Una Map: il testo dell'utente non diventa mai chiave di oggetto. Chiave assente = 'none'. */
export type IcsMapping = ReadonlyMap<string, IcsTarget>
export interface IcsProposal {
  courseId: string
  by: 'previous' | 'code' | 'name'
  score: number
}
export interface IcsGroup {
  summary: string
  lessons: number
  first: ISODate
  last: ISODate
  proposal: IcsProposal | null
}

type CourseLike = Pick<Course, 'id' | 'name' | 'code'> & { deletedAt?: number }

const BRACKETS = /\([^)]*\)|\[[^\]]*\]/g

export function proposeMapping(summaries: string[], courses: CourseLike[], previous: CalendarEvent[]): Map<string, IcsProposal | null> {
  const live = courses.filter((c) => !c.deletedAt)
  const liveIds = new Set(live.map((c) => c.id))
  const out = new Map<string, IcsProposal | null>()
  const coded = live
    .filter((c) => c.code && normalizeName(c.code))
    .map((c) => ({ id: c.id, code: normalizeName(c.code!) }))
    .sort((a, b) => b.code.length - a.code.length)
  const candidates = live.map((c) => ({ id: c.id, name: c.name, code: c.code }))

  for (const summary of new Set(summaries)) {
    if (!summary) {
      out.set(summary, null)
      continue
    }
    // 1. come nell'ultima importazione
    const tally = new Map<string, number>()
    for (const e of previous) {
      if (e.source === 'ics' && !e.deletedAt && e.title === summary && e.courseId && liveIds.has(e.courseId)) tally.set(e.courseId, (tally.get(e.courseId) ?? 0) + 1)
    }
    let prev: string | undefined
    let most = 0
    for (const [id, n] of tally) if (n > most) ((prev = id), (most = n))
    if (prev) {
      out.set(summary, { courseId: prev, by: 'previous', score: 1 })
      continue
    }
    // 2. il codice del corso come parole intere nel titolo
    const padded = ` ${normalizeName(summary)} `
    const byCode = coded.find((c) => padded.includes(` ${c.code} `))
    if (byCode) {
      out.set(summary, { courseId: byCode.id, by: 'code', score: 1 })
      continue
    }
    // 3. il nome, senza le note tra parentesi (docente, aula)
    const m = bestMatch(summary.replace(BRACKETS, ' '), candidates, { threshold: MATCH_THRESHOLD })
    out.set(summary, m ? { courseId: m.id, by: 'name', score: m.score } : null)
  }
  return out
}

export function buildGroups(expansion: IcsExpansion, courses: Course[], previous: CalendarEvent[]): IcsGroup[] {
  const acc = new Map<string, { lessons: number; first: ISODate; last: ISODate }>()
  for (const o of expansion.occurrences) {
    const g = acc.get(o.summary)
    if (!g) acc.set(o.summary, { lessons: 1, first: o.date, last: o.date })
    else {
      g.lessons++
      if (o.date < g.first) g.first = o.date
      if (o.date > g.last) g.last = o.date
    }
  }
  const proposals = proposeMapping([...acc.keys()], courses, previous)
  return [...acc]
    .map(([summary, g]) => ({ summary, ...g, proposal: proposals.get(summary) ?? null }))
    .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : a.summary.localeCompare(b.summary)))
}

export function defaultMapping(groups: IcsGroup[]): IcsMapping {
  return new Map<string, IcsTarget>(groups.map((g) => [g.summary, g.proposal ? { kind: 'course', courseId: g.proposal.courseId } : { kind: 'none' }]))
}
