// Date locali come stringhe 'YYYY-MM-DD' (i giorni dell'utente, non UTC).
// I formati di lettura stanno in src/i18n/format. Le scadenze possono avere solo il mese ('YYYY-MM'): valgono dal 1°.

import { pad } from '../i18n/format/util'

export type ISODate = string

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now)
}

export function isISODate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

export function isMonthOnly(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s)
}

/** 'YYYY-MM' → 'YYYY-MM-01'; le date complete restano uguali. */
export function resolveDate(s: string): ISODate {
  return isMonthOnly(s) ? `${s}-01` : s
}

/** Ultimo giorno del mese di una data ('YYYY-MM' o 'YYYY-MM-DD'). */
export function lastDayOfMonth(iso: string): ISODate {
  const [y, m] = iso.split('-').map(Number) as [number, number]
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  return addDays(next, -1)
}

function parts(iso: ISODate): [number, number, number] {
  const [y, m, d] = resolveDate(iso).split('-').map(Number)
  return [y!, m!, d!]
}

/** Mezzanotte locale del giorno. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = parts(iso)
  return new Date(y, m - 1, d)
}

export function addDays(iso: ISODate, n: number): ISODate {
  const [y, m, d] = parts(iso)
  return toISODate(new Date(y, m - 1, d + n))
}

/** Giorni da `from` a `to` (positivo se `to` è dopo), indipendente dall'ora legale. */
export function diffDays(from: ISODate, to: ISODate): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

/** 1 = lunedì … 7 = domenica. */
export function weekday(iso: ISODate): number {
  const day = parseISODate(iso).getDay()
  return day === 0 ? 7 : day
}

/** Lunedì della settimana che contiene `iso`. */
export function weekStart(iso: ISODate): ISODate {
  return addDays(iso, 1 - weekday(iso))
}

export function weekDays(iso: ISODate): ISODate[] {
  const start = weekStart(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function isBetween(iso: ISODate, from: ISODate, to: ISODate): boolean {
  const day = resolveDate(iso)
  return day >= resolveDate(from) && day <= resolveDate(to)
}

/** Giorni dall'inizio al termine, estremi compresi. */
export function rangeDays(from: ISODate, to: ISODate): ISODate[] {
  const n = diffDays(from, to)
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addDays(from, i))
}

// Orari 'HH:MM' ↔ minuti dalla mezzanotte

export function toMinutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  return `${Math.floor(m / 60)}:${pad(m % 60)}`
}

/** '9:05' → '09:05', per gli input type=time. */
export function toTimeInput(hhmm: string): string {
  const m = toMinutes(hhmm)
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}

export function minutesNow(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes()
}
