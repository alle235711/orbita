// Lettura di un file .ics: solo testo in, strutture fuori. Nessuna rete, nessun orologio.

import { AppError } from '../i18n/errors'
import { parseRRule, type RRule } from './rrule'
import { parseContentLine, splitList, unescapeLine, unfoldLines, type ContentLine } from './text'
import { parseDuration, parseIcsValue, whenKey, type IcsWhen } from './time'

export type { IcsWhen } from './time'

export interface IcsEvent {
  uid: string
  summary: string
  location?: string
  start: IcsWhen
  end?: IcsWhen
  durationSec?: number
  rrule?: RRule
  exdates: IcsWhen[]
  recurrenceId?: IcsWhen
  thisAndFuture: boolean
  cancelled: boolean
  sequence: number
}

export type SkipReason = 'badEvent' | 'rdate' | 'unsupportedRule' | 'thisAndFuture'

export interface IcsParseResult {
  events: IcsEvent[]
  skipped: Record<SkipReason, number>
  warnings: { unknownZone: number }
  skippedUids: string[]
}

type Outcome = { event: IcsEvent; unknownZone: boolean } | { skip: SkipReason }

function buildEvent(lines: ContentLine[]): Outcome {
  const first = (name: string) => lines.find((l) => l.name === name)
  const all = (name: string) => lines.filter((l) => l.name === name)

  let bad = false
  let unknownZone = false
  const when = (l: ContentLine): IcsWhen | undefined => {
    const r = parseIcsValue(l.value, l.params)
    if (!r) {
      bad = true
      return undefined
    }
    if (r.unknownZone) unknownZone = true
    return r.when
  }

  const uid = first('UID')?.value.trim() ?? ''
  const dtstart = first('DTSTART')
  if (!uid || !dtstart) bad = true
  const start = dtstart ? when(dtstart) : undefined
  const dtend = first('DTEND')
  const end = dtend ? when(dtend) : undefined
  const dur = first('DURATION')
  let durationSec: number | undefined
  if (dur) {
    const s = parseDuration(dur.value)
    if (s === null) bad = true
    else durationSec = s
  }
  const rec = first('RECURRENCE-ID')
  const recurrenceId = rec ? when(rec) : undefined
  const exdates: IcsWhen[] = []
  for (const l of all('EXDATE')) {
    for (const v of splitList(l.value)) {
      const r = parseIcsValue(v, l.params)
      if (!r) bad = true
      else {
        if (r.unknownZone) unknownZone = true
        exdates.push(r.when)
      }
    }
  }
  let rrule: RRule | undefined
  let unsupported = all('EXRULE').length > 0
  const rr = first('RRULE')
  if (rr) {
    const parsed = parseRRule(rr.value)
    if (parsed.ok) rrule = parsed.rule
    else if (parsed.reason === 'badEvent') bad = true
    else unsupported = true
  }
  if (bad) return { skip: 'badEvent' }
  if (first('RDATE')) return { skip: 'rdate' }
  if (unsupported) return { skip: 'unsupportedRule' }
  const thisAndFuture = !!rec && (rec.params.RANGE?.[0] ?? '').toUpperCase() === 'THISANDFUTURE'
  if (thisAndFuture) return { skip: 'thisAndFuture' }

  const seq = Number.parseInt(first('SEQUENCE')?.value ?? '', 10)
  const summary = first('SUMMARY')
  const loc = first('LOCATION')
  const location = loc ? unescapeLine(loc.value) : ''
  return {
    unknownZone,
    event: {
      uid,
      summary: summary ? unescapeLine(summary.value) : '',
      location: location || undefined,
      start: start!,
      end,
      durationSec: end ? undefined : durationSec,
      rrule,
      exdates,
      recurrenceId,
      thisAndFuture: false,
      cancelled: (first('STATUS')?.value ?? '').trim().toUpperCase() === 'CANCELLED',
      sequence: Number.isFinite(seq) ? seq : 0,
    },
  }
}

/** Legge un calendario .ics. Lancia AppError se il file non è un calendario completo. */
export function parseIcs(text: string): IcsParseResult {
  const logical = unfoldLines(text)
  if (!logical.length || !/^BEGIN:VCALENDAR\s*$/i.test(logical[0]!.trim())) throw new AppError('icsNotCalendar')

  const stack: string[] = []
  let closed = false
  let current: ContentLine[] | null = null
  const outcomes: { uid: string; master: boolean; o: Outcome }[] = []
  let sawEvent = false

  for (const raw of logical) {
    const line = parseContentLine(raw)
    if (!line) continue
    if (line.name === 'BEGIN') {
      const comp = line.value.trim().toUpperCase()
      stack.push(comp)
      if (comp === 'VEVENT') {
        current = []
        sawEvent = true
      }
      continue
    }
    if (line.name === 'END') {
      const comp = line.value.trim().toUpperCase()
      const at = stack.lastIndexOf(comp)
      if (at < 0) continue
      stack.length = at
      if (comp === 'VEVENT' && current) {
        const o = buildEvent(current)
        const uid = current.find((l) => l.name === 'UID')?.value.trim() ?? ''
        outcomes.push({ uid, master: !current.some((l) => l.name === 'RECURRENCE-ID'), o })
        current = null
      }
      if (comp === 'VCALENDAR') closed = true
      continue
    }
    if (current && stack[stack.length - 1] === 'VEVENT') current.push(line)
  }
  if (!closed || current) throw new AppError('icsTruncated')
  if (!sawEvent) throw new AppError('icsNoEvents')

  const skipped: Record<SkipReason, number> = { badEvent: 0, rdate: 0, unsupportedRule: 0, thisAndFuture: 0 }
  const skippedUids = new Set<string>()
  let unknownZone = 0
  const kept: IcsEvent[] = []
  for (const { uid, master, o } of outcomes) {
    if ('skip' in o) {
      skipped[o.skip]++
      if (master && uid && o.skip !== 'thisAndFuture') skippedUids.add(uid)
    } else {
      if (o.unknownZone) unknownZone++
      kept.push(o.event)
    }
  }

  // Doppioni: vince SEQUENCE più alto, a parità l'ultimo del file.
  const winners = new Map<string, number>()
  kept.forEach((e, i) => {
    const key = `${e.uid}\u0000${e.recurrenceId ? whenKey(e.recurrenceId) : ''}`
    const w = winners.get(key)
    if (w === undefined || kept[w]!.sequence <= e.sequence) winners.set(key, i)
  })
  const keepIdx = new Set(winners.values())
  const events = kept.filter((_, i) => keepIdx.has(i))

  return { events, skipped, warnings: { unknownZone }, skippedUids: [...skippedUids] }
}
