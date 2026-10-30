// RRULE: solo il sottoinsieme che serve a un orario (DAILY e WEEKLY).

import { parseIcsValue, type IcsWhen } from './time'

export interface RRule {
  freq: 'DAILY' | 'WEEKLY'
  interval: number
  count?: number
  until?: IcsWhen
  /** Giorni ISO 1..7, ordinati e senza doppioni; [] = non indicato. */
  byDay: number[]
  /** Giorno ISO di WKST, default 1 (lunedì). */
  wkst: number
}

const DAYS: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7 }
const KNOWN_PARTS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST'])

export function parseRRule(value: string): { ok: true; rule: RRule } | { ok: false; reason: 'unsupportedRule' | 'badEvent' } {
  const parts = new Map<string, string>()
  for (const raw of value.split(';')) {
    if (!raw.trim()) continue
    const eq = raw.indexOf('=')
    if (eq < 0) return { ok: false, reason: 'badEvent' }
    const key = raw.slice(0, eq).trim().toUpperCase()
    if (parts.has(key)) return { ok: false, reason: 'badEvent' }
    parts.set(key, raw.slice(eq + 1).trim())
  }
  const freq = parts.get('FREQ')?.toUpperCase()
  if (!freq) return { ok: false, reason: 'badEvent' }

  let interval = 1
  if (parts.has('INTERVAL')) {
    const s = parts.get('INTERVAL')!
    if (!/^\d+$/.test(s) || Number(s) < 1) return { ok: false, reason: 'badEvent' }
    interval = Number(s)
  }
  let count: number | undefined
  if (parts.has('COUNT')) {
    const s = parts.get('COUNT')!
    if (!/^\d+$/.test(s) || Number(s) < 1) return { ok: false, reason: 'badEvent' }
    count = Number(s)
  }
  let until: IcsWhen | undefined
  if (parts.has('UNTIL')) {
    const r = parseIcsValue(parts.get('UNTIL')!, {})
    if (!r) return { ok: false, reason: 'badEvent' }
    until = r.when
  }

  // Dopo i controlli di forma: quello che non sappiamo espandere.
  for (const key of parts.keys()) if (!KNOWN_PARTS.has(key)) return { ok: false, reason: 'unsupportedRule' }
  if (freq !== 'DAILY' && freq !== 'WEEKLY') return { ok: false, reason: 'unsupportedRule' }

  const byDay: number[] = []
  if (parts.has('BYDAY')) {
    for (const tok of parts.get('BYDAY')!.split(',')) {
      const d = DAYS[tok.trim().toUpperCase()]
      if (d === undefined) return { ok: false, reason: 'unsupportedRule' }
      if (!byDay.includes(d)) byDay.push(d)
    }
    byDay.sort((a, b) => a - b)
  }
  let wkst = 1
  if (parts.has('WKST')) {
    const d = DAYS[parts.get('WKST')!.toUpperCase()]
    if (d === undefined) return { ok: false, reason: 'unsupportedRule' }
    wkst = d
  }
  return { ok: true, rule: { freq, interval, count, until, byDay, wkst } }
}
