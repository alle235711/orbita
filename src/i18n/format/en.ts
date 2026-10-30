// English formats (British, day before month). Names are hand-written, not from Intl.

import { isMonthOnly, weekday, type ISODate } from '../../lib/dates'
import type { DateOpts, Format } from './types'
import { capitalize, pad } from './util'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']
const LOCALE = 'en-GB'
const SUFFIX: Record<string, string> = { one: 'st', two: 'nd', few: 'rd' }

const plurals = new Intl.PluralRules(LOCALE)
const ordinals = new Intl.PluralRules(LOCALE, { type: 'ordinal' })

const parts = (s: string): [number, number, number] => {
  const [y, m, d] = s.split('-').map(Number)
  return [y!, m!, d!]
}

const monthName = (month: number) => MONTHS[month - 1]!
const monthShort = (month: number) => MONTHS_SHORT[month - 1]!

function date(iso: string, o: { year?: boolean } = {}): string {
  const [y, m, d] = parts(iso)
  if (isMonthOnly(iso)) return `${monthName(m)} ${y}`
  return `${d} ${monthName(m)}${o.year ? ` ${y}` : ''}`
}

function dateShort(iso: string): string {
  const [, m, d] = parts(iso)
  return isMonthOnly(iso) ? monthShort(m) : `${d} ${monthShort(m)}`
}

function inMonth(iso: string, o: { year?: boolean; capital?: boolean } = {}): string {
  const [y, m] = parts(iso)
  return `${o.capital ? 'In' : 'in'} ${monthName(m)}${o.year ? ` ${y}` : ''}`
}

const text = (iso: string, o: DateOpts) => (o.short ? dateShort(iso) : date(iso, { year: o.year }))
const prepWith = (prep: string, iso: string, o: DateOpts = {}) => `${o.capital ? capitalize(prep) : prep} ${text(iso, o)}`

function number(n: number, digits = 1): string {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

const plural = (n: number, one: string, other: string) => (plurals.select(n) === 'one' ? one : other)

export const enFormat: Format = {
  lang: 'en',
  locale: LOCALE,
  monthName,
  monthShort,
  weekdayName: (day) => WEEKDAYS[day - 1]!,
  weekdayShort: (day) => WEEKDAYS_SHORT[day - 1]!,
  date,
  dateShort,
  dateLong: (iso: ISODate) => `${WEEKDAYS[weekday(iso) - 1]!} ${date(iso)}`,
  on: (iso, o = {}) => (isMonthOnly(iso) ? inMonth(iso, { year: true, capital: o.capital }) : prepWith('on', iso, o)),
  from: (iso, o) => prepWith('from', iso, o),
  to: (iso, o) => prepWith('to', iso, o),
  until: (iso, o) => prepWith('until', iso, o),
  of: (iso, o) => prepWith('of', iso, o),
  inMonth,
  relativeDays(n) {
    if (n === 0) return 'today'
    if (n === 1) return 'tomorrow'
    if (n === -1) return 'yesterday'
    return n > 0 ? `in ${n} days` : `${-n} days ago`
  },
  minutes(n) {
    const m = Math.round(n)
    if (m < 60) return `${m} min`
    const h = Math.floor(m / 60)
    const r = m % 60
    return r ? `${h} h ${pad(r)}` : `${h} h`
  },
  hours: (h) => `${number(Math.round(h * 2) / 2)} h`,
  number,
  plural,
  count: (n, one, other) => `${n} ${plural(n, one, other)}`,
  ordinal: (n) => `${n}${SUFFIX[ordinals.select(n)] ?? 'th'}`,
  numberWord: (n) => WORDS[n] ?? String(n),
}
