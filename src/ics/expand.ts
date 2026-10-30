// Espansione delle ricorrenze in occorrenze. Pura: niente orologio, niente ora locale del dispositivo.
// La ricorrenza gira nell'ora a muro del fuso del master (RFC 5545); la visualizzazione converte nel fuso richiesto.

import type { ISODate } from '../lib/dates'
import type { IcsEvent, IcsParseResult } from './parse'
import type { RRule } from './rrule'
import { epochDay, fromEpochDay, instantToWall, isoWeekday, isValidZone, wallMs, whenInstant, whenKey, type IcsWhen } from './time'

export const MAX_STEPS = 20_000
export const MAX_PER_SERIES = 1_000
export const MAX_TOTAL = 10_000
const MARGIN_DAYS = 2
const DAY_MS = 86_400_000
const END_OF_DAY = '23:59'

export interface IcsOccurrence {
  id: string
  uid: string
  key: string
  summary: string
  location?: string
  allDay: boolean
  date: ISODate
  start: string
  end: string
  endClamped: boolean
  moved: boolean
}
export interface IcsSeries {
  uid: string
  summary: string
  cancelled: boolean
  occurrences: number
}
export interface IcsExpansion {
  window: { from: ISODate; to: ISODate }
  displayZone: string
  occurrences: IcsOccurrence[]
  series: IcsSeries[]
  stats: { tooMany: number; allDay: number }
}
export interface ExpandOptions {
  window: { from: ISODate; to: ISODate }
  displayZone: string
}

/** Millisecondi "a muro" di un valore, per i confronti tra valori dello stesso tipo. */
const wallValue = (w: IcsWhen): number => (w.kind === 'date' ? wallMs(w.date, '00:00:00') : wallMs(w.date, w.time))

/** Il valore `b` (EXDATE, RECURRENCE-ID) indica l'inizio originale `a`? */
function sameStart(a: IcsWhen, b: IcsWhen): boolean {
  if (b.kind === 'date' || a.kind === 'date') return a.date === b.date
  if (b.kind === 'floating') return a.date === b.date && a.time === b.time
  const bi = whenInstant(b)
  const ai = whenInstant(a)
  return ai !== null ? ai === bi : wallValue(a) === bi
}

/** Durata dell'evento in ms: DTEND nel suo fuso, oppure DURATION, oppure un giorno (tutto il giorno) o 0. */
function durationMs(ev: IcsEvent): number | undefined {
  let ms: number | undefined
  if (ev.end) {
    const instant = (w: IcsWhen) => whenInstant(w) ?? wallValue(w)
    ms = ev.start.kind === 'date' && ev.end.kind === 'date' ? (epochDay(ev.end.date) - epochDay(ev.start.date)) * DAY_MS : instant(ev.end) - instant(ev.start)
  } else if (ev.durationSec !== undefined) ms = ev.durationSec * 1000
  return ms === undefined ? undefined : Math.max(0, ms)
}
const defaultDuration = (ev: IcsEvent): number => durationMs(ev) ?? (ev.start.kind === 'date' ? DAY_MS : 0)

const withDate = (w: IcsWhen, date: ISODate): IcsWhen => ({ ...w, date }) as IcsWhen

/** Un candidato supera UNTIL (inclusivo)? */
function pastUntil(start: IcsWhen, date: ISODate, until: IcsWhen): boolean {
  const cand = withDate(start, date)
  if (until.kind === 'date') return date > until.date
  if (until.kind === 'floating') return wallValue(cand) > wallValue(until)
  const inst = whenInstant(cand) ?? wallValue(cand)
  return inst > whenInstant(until)!
}

/** Date candidate (ora a muro del master) dentro [lo, hi] giorni epoch; `tooMany` se supera MAX_STEPS. */
function candidates(start: IcsWhen, rule: RRule | undefined, lo: number, hi: number): { dates: ISODate[]; tooMany: boolean } {
  const e0 = epochDay(start.date)
  if (!rule) return { dates: e0 >= lo && e0 <= hi ? [start.date] : [], tooMany: false }

  const out: ISODate[] = []
  let steps = 0
  let produced = 0
  let stop = false
  // true = continua; false = fine (UNTIL, COUNT o oltre la finestra)
  const take = (e: number): boolean => {
    if (e > hi) return false
    const date = fromEpochDay(e)
    if (rule.until && pastUntil(start, date, rule.until)) return false
    produced++
    if (rule.count !== undefined && produced > rule.count) return false
    if (e >= lo) out.push(date)
    return true
  }

  if (rule.freq === 'DAILY') {
    const k0 = rule.count === undefined ? Math.max(0, Math.floor((lo - e0) / rule.interval)) : 0
    for (let k = k0; !stop; k++) {
      if (++steps > MAX_STEPS) return { dates: [], tooMany: true }
      const e = e0 + k * rule.interval
      if (e > hi) break
      if (rule.byDay.length && !rule.byDay.includes(isoWeekday(e))) continue
      if (!take(e)) stop = true
    }
  } else {
    const byDays = rule.byDay.length ? rule.byDay : [isoWeekday(e0)]
    const ws0 = e0 - ((isoWeekday(e0) - rule.wkst + 7) % 7)
    let j0 = 0
    if (rule.count === undefined) j0 = Math.floor(Math.max(0, Math.floor((lo - ws0) / 7)) / rule.interval) * rule.interval
    for (let j = j0; !stop; j += rule.interval) {
      if (++steps > MAX_STEPS) return { dates: [], tooMany: true }
      const ws = ws0 + 7 * j
      if (ws > hi) break
      for (let off = 0; off < 7 && !stop; off++) {
        const wd = ((rule.wkst - 1 + off) % 7) + 1
        const e = ws + off
        if (!byDays.includes(wd) || e < e0) continue
        if (!take(e)) stop = true
      }
    }
  }
  return { dates: out, tooMany: false }
}

interface Pending {
  key: string
  uid: string
  summary: string
  location?: string
  start: IcsWhen
  durMs: number
  moved: boolean
}

function render(p: Pending, displayZone: string): IcsOccurrence | 'allDay' {
  if (p.start.kind === 'date') return 'allDay'
  let date: ISODate
  let start: string
  let endWall: { date: ISODate; time: string }
  const inst = whenInstant(p.start)
  if (inst !== null) {
    const s = instantToWall(displayZone, inst)
    date = s.date
    start = s.time.slice(0, 5)
    endWall = instantToWall(displayZone, inst + p.durMs)
  } else {
    date = p.start.date
    start = (p.start as { time: string }).time.slice(0, 5)
    endWall = instantToWall('UTC', wallValue(p.start) + p.durMs)
  }
  const clamped = endWall.date > date
  return {
    id: `ics:${p.uid}:${p.key}`,
    uid: p.uid,
    key: p.key,
    summary: p.summary,
    location: p.location,
    allDay: false,
    date,
    start,
    end: clamped ? END_OF_DAY : endWall.time.slice(0, 5),
    endClamped: clamped,
    moved: p.moved,
  }
}

export function expandIcs(parsed: IcsParseResult, opts: ExpandOptions): IcsExpansion {
  const displayZone = isValidZone(opts.displayZone) ? opts.displayZone : 'UTC'
  const { window } = opts
  const lo = epochDay(window.from) - MARGIN_DAYS
  const hi = epochDay(window.to) + MARGIN_DAYS
  const skipped = new Set(parsed.skippedUids)

  // Per UID, nell'ordine del file.
  const byUid = new Map<string, IcsEvent[]>()
  for (const ev of parsed.events) {
    if (skipped.has(ev.uid)) continue
    const list = byUid.get(ev.uid)
    if (list) list.push(ev)
    else byUid.set(ev.uid, [ev])
  }

  const all: IcsOccurrence[] = []
  const series: IcsSeries[] = []
  const stats = { tooMany: 0, allDay: 0 }
  let total = 0

  for (const [uid, events] of byUid) {
    const master = events.find((e) => !e.recurrenceId)
    const overrides = events.filter((e) => e.recurrenceId)
    const pending: Pending[] = []
    let tooMany = false

    const used = new Set<IcsEvent>()
    if (master && !master.cancelled) {
      const dur = defaultDuration(master)
      const gen = candidates(master.start, master.rrule, lo, hi)
      tooMany = gen.tooMany
      for (const date of gen.dates) {
        const orig = withDate(master.start, date)
        const key = whenKey(orig)
        const ov = overrides.find((o) => sameStart(orig, o.recurrenceId!))
        // EXDATE per primo; un'eccezione esplicita vince.
        if (!ov && master.exdates.some((x) => sameStart(orig, x))) continue
        if (!ov) {
          pending.push({ key, uid, summary: master.summary, location: master.location, start: orig, durMs: dur, moved: false })
          continue
        }
        used.add(ov)
        if (ov.cancelled) continue
        pending.push({
          key,
          uid,
          summary: ov.summary || master.summary,
          location: ov.location ?? master.location,
          start: ov.start,
          durMs: durationMs(ov) ?? dur,
          moved: true,
        })
      }
    }
    // Eccezioni senza occorrenza generata (master assente, annullato o fuori dall'intervallo): si importano da sole.
    for (const ov of overrides) {
      if (used.has(ov) || ov.cancelled || tooMany) continue
      pending.push({
        key: whenKey(ov.recurrenceId!),
        uid,
        summary: ov.summary || master?.summary || '',
        location: ov.location ?? master?.location,
        start: ov.start,
        durMs: durationMs(ov) ?? (master ? defaultDuration(master) : defaultDuration(ov)),
        moved: true,
      })
    }
    if (tooMany) {
      stats.tooMany++
      continue
    }

    const rendered: IcsOccurrence[] = []
    let allDay = 0
    for (const p of pending) {
      const r = render(p, displayZone)
      if (r === 'allDay') {
        if (p.start.date >= window.from && p.start.date <= window.to) allDay++
        continue
      }
      if (r.date >= window.from && r.date <= window.to) rendered.push(r)
    }
    if (rendered.length > MAX_PER_SERIES || total + rendered.length > MAX_TOTAL) {
      stats.tooMany++
      continue
    }
    total += rendered.length
    stats.allDay += allDay
    all.push(...rendered)
    const firstLive = overrides.find((o) => !o.cancelled) ?? overrides[0]
    series.push({
      uid,
      summary: master ? master.summary : (firstLive?.summary ?? ''),
      cancelled: !!master?.cancelled,
      occurrences: 0,
    })
  }

  all.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const seen = new Set<string>()
  const occurrences = all.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true)))
  const counts = new Map<string, number>()
  for (const o of occurrences) counts.set(o.uid, (counts.get(o.uid) ?? 0) + 1)
  for (const s of series) s.occurrences = counts.get(s.uid) ?? 0

  return { window, displayZone, occurrences, series, stats }
}
