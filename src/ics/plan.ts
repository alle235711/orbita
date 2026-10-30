// Confronto tra quello che il file chiede e quello che c'è già: nuove, cambiate, tolte. Puro.
// Garanzie: una lezione modificata o cancellata dall'utente non si tocca; fuori dalla finestra e fuori dalle serie
// del file non si cancella niente (così un secondo corso di laurea non cancella il primo).

import type { CalendarEvent } from '../db/schema'
import type { IcsExpansion } from './expand'
import type { IcsMapping, IcsTarget } from './mapping'

export type IcsEventRow = Omit<CalendarEvent, 'updatedAt'>
export interface IcsImportPlan {
  add: IcsEventRow[]
  update: { id: string; changes: Partial<IcsEventRow> }[]
  remove: string[]
  unchanged: number
  keptEdited: number
}

const COMPARED = ['date', 'start', 'end', 'title', 'courseId', 'location', 'type'] as const
const NONE: IcsTarget = { kind: 'none' }
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function planIcsImport(existing: CalendarEvent[], expansion: IcsExpansion, mapping: IcsMapping, untitled = ''): IcsImportPlan {
  const targetOf = (summary: string): IcsTarget => mapping.get(summary) ?? NONE
  const rows = new Map<string, CalendarEvent>()
  for (const e of existing) if (e.source === 'ics') rows.set(e.id, e)

  // Insieme desiderato
  const desired = new Map<string, IcsEventRow>()
  for (const o of expansion.occurrences) {
    const target = targetOf(o.summary)
    if (o.allDay || target.kind === 'skip') continue
    const row: IcsEventRow = {
      id: o.id,
      date: o.date,
      start: o.start,
      end: o.end,
      title: o.summary || untitled,
      type: 'lezione',
      suggested: false,
      confirmed: true,
      source: 'ics',
      uid: o.uid,
    }
    if (target.kind === 'course') row.courseId = target.courseId
    if (o.location) row.location = o.location
    desired.set(o.id, row)
  }

  const plan: IcsImportPlan = { add: [], update: [], remove: [], unchanged: 0, keptEdited: 0 }
  for (const r of desired.values()) {
    const e = rows.get(r.id)
    if (!e) plan.add.push(r)
    else if (e.userEdited) plan.keptEdited++
    else if (e.deletedAt) plan.add.push(r)
    else {
      const changes: Partial<IcsEventRow> = {}
      for (const k of COMPARED) if (e[k] !== r[k]) (changes as Record<string, unknown>)[k] = r[k]
      if (Object.keys(changes).length) plan.update.push({ id: r.id, changes })
      else plan.unchanged++
    }
  }

  // Cancellazioni: solo serie del file, dentro la finestra
  const authoritative = new Set(expansion.series.filter((s) => targetOf(s.summary).kind !== 'skip').map((s) => s.uid))
  const { from, to } = expansion.window
  for (const e of rows.values()) {
    if (e.deletedAt || !e.uid || !authoritative.has(e.uid) || e.date < from || e.date > to || desired.has(e.id)) continue
    if (e.userEdited) plan.keptEdited++
    else plan.remove.push(e.id)
  }

  plan.add.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : byId(a, b)))
  plan.update.sort(byId)
  plan.remove.sort()
  return plan
}
