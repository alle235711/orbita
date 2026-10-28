// Date locali come stringhe 'YYYY-MM-DD' (i giorni dell'utente, non UTC).
// Le scadenze possono avere solo il mese ('YYYY-MM'): valgono dal 1°.

export type ISODate = string

const pad = (n: number) => String(n).padStart(2, '0')

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

// Formati in italiano

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const WEEKDAYS_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

export function monthName(month: number): string {
  return MONTHS[month - 1]!
}

export function monthShort(month: number): string {
  return MONTHS_SHORT[month - 1]!
}

export function weekdayName(iso: ISODate): string {
  return WEEKDAYS[weekday(iso) - 1]!
}

export function weekdayShort(iso: ISODate): string {
  return WEEKDAYS_SHORT[weekday(iso) - 1]!
}

/** '2026-11-13' → '13 novembre'; '2027-02' → 'febbraio 2027'. */
export function formatDate(s: string, withYear = false): string {
  const [y, m, d] = s.split('-').map(Number)
  if (isMonthOnly(s)) return `${monthName(m!)} ${y}`
  return `${d} ${monthName(m!)}${withYear ? ` ${y}` : ''}`
}

/** '2026-11-13' → '13 nov'; '2027-02' → 'feb'. */
export function formatShort(s: string): string {
  const [, m, d] = s.split('-').map(Number)
  return isMonthOnly(s) ? monthShort(m!) : `${d} ${monthShort(m!)}`
}

/**
 * Unisce articolo o preposizione articolata a una data già formattata, con
 * l'elisione davanti a 8 e 11 (otto, undici): ('il', '8 novembre') → 'l’8 novembre',
 * ('dal', '11 gen') → 'dall’11 gen'. Il resto resta con lo spazio: 'il 18 novembre',
 * 'il 1 marzo', 'a febbraio 2027'.
 */
export function withDate(prep: string, date: string): string {
  const stem = ELIDABLE.get(prep.toLowerCase())
  if (stem === undefined || !/^(8|11)(?!\d)/.test(date)) return `${prep} ${date}`
  const head = prep[0] === prep[0]!.toUpperCase() ? capitalize(stem) : stem
  return `${head}’${date}`
}

const ELIDABLE = new Map([
  ['il', 'l'],
  ['dal', 'dall'],
  ['al', 'all'],
  ['del', 'dell'],
  ['nel', 'nell'],
  ['sul', 'sull'],
])

/** 'lunedì 26 ottobre' */
export function formatLong(iso: ISODate): string {
  return `${weekdayName(iso)} ${formatDate(iso)}`
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** 'tra 17 giorni', 'domani', 'oggi', 'ieri', '3 giorni fa' */
export function relativeDays(n: number): string {
  if (n === 0) return 'oggi'
  if (n === 1) return 'domani'
  if (n === -1) return 'ieri'
  return n > 0 ? `tra ${n} giorni` : `${-n} giorni fa`
}

/** 75 → '1 h 15', 45 → '45 min', 120 → '2 h' */
export function formatMinutes(minutes: number): string {
  const m = Math.round(minutes)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${pad(r)}` : `${h} h`
}

/** 6.5 → '6,5' */
export function formatDecimal(n: number, digits = 1): string {
  return n.toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}
