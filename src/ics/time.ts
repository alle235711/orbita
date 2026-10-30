// Date civili e fusi orari senza toccare l'ora locale del dispositivo:
// solo Date.UTC / getUTC* e Intl.DateTimeFormat con `timeZone`.

import type { ISODate } from '../lib/dates'

export type CivilDate = { y: number; m: number; d: number }

const DAY_MS = 86_400_000
const MIN_YEAR = 1900
const MAX_YEAR = 2200

const p2 = (n: number): string => String(n).padStart(2, '0')
const p4 = (n: number): string => String(n).padStart(4, '0')

export function civil(iso: ISODate): CivilDate {
  const [y, m, d] = iso.split('-').map(Number)
  return { y: y!, m: m!, d: d! }
}

export const isoOf = (c: CivilDate): ISODate => `${p4(c.y)}-${p2(c.m)}-${p2(c.d)}`

/** Giorni dal 1970-01-01. */
export function epochDay(iso: ISODate): number {
  const c = civil(iso)
  return Math.round(Date.UTC(c.y, c.m - 1, c.d) / DAY_MS)
}

export function fromEpochDay(n: number): ISODate {
  const d = new Date(n * DAY_MS)
  return `${p4(d.getUTCFullYear())}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}

/** 1 = lunedì … 7 = domenica, da un epochDay (il 1970-01-01 era un giovedì). */
export function isoWeekday(day: number): number {
  return ((((day + 3) % 7) + 7) % 7) + 1
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function isValidDate(y: number, m: number, d: number): boolean {
  return y >= MIN_YEAR && y <= MAX_YEAR && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

/** Somma mesi a una data; se il giorno non esiste nel mese di arrivo scende all'ultimo. */
export function addMonthsClamped(iso: ISODate, n: number): ISODate {
  const c = civil(iso)
  const total = c.y * 12 + (c.m - 1) + n
  const y = Math.floor(total / 12)
  const m = (total % 12) + 1
  return isoOf({ y, m, d: Math.min(c.d, daysInMonth(y, m)) })
}

// ---- fusi ----

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export function resolveZone(tzid: string): string | null {
  const t = tzid.trim().replace(/^"|"$/g, '')
  if (!t) return null
  if (isValidZone(t)) return t
  if (t.includes('/')) {
    const segs = t.split('/').filter(Boolean)
    const two = segs.slice(-2).join('/')
    if (segs.length >= 2 && isValidZone(two)) return two
    const one = segs[segs.length - 1]
    if (one && isValidZone(one)) return one
  }
  return null
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(zone, f)
  }
  return f
}

interface Wall {
  y: number
  m: number
  d: number
  h: number
  mi: number
  s: number
}

function wallOf(zone: string, utcMs: number): Wall {
  const parts = formatterFor(zone).formatToParts(new Date(Math.floor(utcMs / 1000) * 1000))
  const get = (t: string): number => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const h = get('hour')
  return { y: get('year'), m: get('month'), d: get('day'), h: h === 24 ? 0 : h, mi: get('minute'), s: get('second') }
}

/** Millisecondi da SOMMARE a UTC per avere l'ora a muro nel fuso. */
export function offsetAt(zone: string, utcMs: number): number {
  if (zone === 'UTC') return 0
  const w = wallOf(zone, utcMs)
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(utcMs / 1000) * 1000
}

export function instantToWall(zone: string, utcMs: number): { date: ISODate; time: string } {
  if (zone === 'UTC') {
    const d = new Date(Math.floor(utcMs / 1000) * 1000)
    return {
      date: `${p4(d.getUTCFullYear())}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`,
      time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,
    }
  }
  const w = wallOf(zone, utcMs)
  return { date: `${p4(w.y)}-${p2(w.m)}-${p2(w.d)}`, time: `${p2(w.h)}:${p2(w.mi)}:${p2(w.s)}` }
}

/** Ora a muro letta come se fosse UTC, in ms. `time` è 'HH:MM' o 'HH:MM:SS'. */
export function wallMs(date: ISODate, time: string): number {
  const c = civil(date)
  const [h, mi, s] = time.split(':').map(Number)
  return Date.UTC(c.y, c.m - 1, c.d, h!, mi ?? 0, s ?? 0)
}

/** Ora a muro → istante UTC (ms). Ora ripetuta: la prima; ora inesistente: l'offset di prima del salto (RFC 5545 §3.3.5). */
export function wallToInstant(zone: string, date: ISODate, time: string): number {
  const wall = wallMs(date, time)
  if (zone === 'UTC') return wall
  const oA = offsetAt(zone, wall - DAY_MS)
  const oB = offsetAt(zone, wall + DAY_MS)
  const valid: number[] = []
  for (const o of oA === oB ? [oA] : [oA, oB]) {
    const t = wall - o
    if (offsetAt(zone, t) === o) valid.push(t)
  }
  if (valid.length) return Math.min(...valid)
  return wall - oA
}

// ---- valori ----

export type IcsWhen =
  | { kind: 'date'; date: ISODate }
  | { kind: 'floating'; date: ISODate; time: string }
  | { kind: 'utc'; date: ISODate; time: string }
  | { kind: 'zoned'; date: ISODate; time: string; tzid: string }

export function parseIcsValue(value: string, params: Record<string, string[]>): { when: IcsWhen; unknownZone: boolean } | null {
  const v = value.trim()
  const m8 = /^(\d{4})(\d{2})(\d{2})$/.exec(v)
  if (m8) {
    const [y, mo, d] = [Number(m8[1]), Number(m8[2]), Number(m8[3])]
    if (!isValidDate(y, mo, d)) return null
    return { when: { kind: 'date', date: isoOf({ y, m: mo, d }) }, unknownZone: false }
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z?)$/i.exec(v)
  if (!m) return null
  const [y, mo, d, h, mi] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])]
  const s = m[6] ? Number(m[6]) : 0
  if (!isValidDate(y, mo, d) || h > 23 || mi > 59 || s > 60) return null
  const date = isoOf({ y, m: mo, d })
  const time = `${p2(h)}:${p2(mi)}:${p2(Math.min(s, 59))}`
  if (m[7]) return { when: { kind: 'utc', date, time }, unknownZone: false }
  const tz = params.TZID?.[0]
  if (tz) {
    const zone = resolveZone(tz)
    if (zone) return { when: { kind: 'zoned', date, time, tzid: zone }, unknownZone: false }
    return { when: { kind: 'floating', date, time }, unknownZone: true }
  }
  return { when: { kind: 'floating', date, time }, unknownZone: false }
}

/** Durata RFC 5545 in secondi: [+-]P[nW][nD][T[nH][nM][nS]]. */
export function parseDuration(value: string): number | null {
  const v = value.trim()
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i.exec(v)
  if (!m || /P$/i.test(v) || /T$/i.test(v)) return null
  const n = (i: number) => Number(m[i] ?? 0)
  const sec = n(2) * 604800 + n(3) * 86400 + n(4) * 3600 + n(5) * 60 + n(6)
  return m[1] === '-' ? -sec : sec
}

/** Istante UTC (ms) di un valore con ora; null per i valori di sola data e per quelli fluttuanti. */
export function whenInstant(w: IcsWhen): number | null {
  if (w.kind === 'utc') return wallMs(w.date, w.time)
  if (w.kind === 'zoned') return wallToInstant(w.tzid, w.date, w.time)
  return null
}

/** Chiave stabile di un inizio: UTC `YYYYMMDDTHHMMSSZ`, fluttuante `YYYYMMDDTHHMMSS`, data `YYYYMMDD` (senza ':'). */
export function whenKey(w: IcsWhen): string {
  const compact = (iso: string) => iso.replace(/-/g, '')
  if (w.kind === 'date') return compact(w.date)
  if (w.kind === 'floating') return `${compact(w.date)}T${w.time.replace(/:/g, '')}`
  const { date, time } = instantToWall('UTC', whenInstant(w)!)
  return `${compact(date)}T${time.replace(/:/g, '')}Z`
}
