// Formati in italiano: gli array dei nomi sono scritti a mano, non vengono da Intl.

import { isMonthOnly, weekday, type ISODate } from '../../lib/dates'
import type { DateOpts, Format, Gender } from './types'
import { capitalize, pad } from './util'

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const WEEKDAYS = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
const WEEKDAYS_SHORT = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
const LOCALE = 'it-IT'

const ELIDABLE = new Map([
  ['il', 'l'],
  ['dal', 'dall'],
  ['al', 'all'],
  ['del', 'dell'],
  ['nel', 'nell'],
  ['sul', 'sull'],
])

/**
 * Unisce articolo o preposizione articolata a una data già formattata, con
 * l'elisione davanti a 8 e 11 (otto, undici): ('il', '8 novembre') → 'l’8 novembre',
 * ('dal', '11 gen') → 'dall’11 gen'. Il resto resta con lo spazio: 'il 18 novembre',
 * 'il 1 marzo', 'a febbraio 2027'.
 */
export function elide(prep: string, dateText: string): string {
  const stem = ELIDABLE.get(prep.toLowerCase())
  if (stem === undefined || !/^(8|11)(?!\d)/.test(dateText)) return `${prep} ${dateText}`
  const head = prep[0] === prep[0]!.toUpperCase() ? capitalize(stem) : stem
  return `${head}’${dateText}`
}

const FEM = ['zero', 'una', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette']
const MASC = ['zero', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette']
const ORD_F = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima']
const ORD_M = ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo']

const plurals = new Intl.PluralRules(LOCALE)

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
  const name = monthName(m)
  const prep = name.startsWith('a') ? 'ad' : 'a'
  return `${o.capital ? capitalize(prep) : prep} ${name}${o.year ? ` ${y}` : ''}`
}

const text = (iso: string, o: DateOpts) => (o.short ? dateShort(iso) : date(iso, { year: o.year }))
const prepWith = (prep: string, iso: string, o: DateOpts = {}) => elide(o.capital ? capitalize(prep) : prep, text(iso, o))

function number(n: number, digits = 1): string {
  return n.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

const plural = (n: number, one: string, other: string) => (plurals.select(n) === 'one' ? one : other)

export const itFormat: Format = {
  lang: 'it',
  locale: LOCALE,
  monthName,
  monthShort,
  weekdayName: (day) => WEEKDAYS[day - 1]!,
  weekdayShort: (day) => WEEKDAYS_SHORT[day - 1]!,
  date,
  dateShort,
  dateLong: (iso: ISODate) => `${WEEKDAYS[weekday(iso) - 1]!} ${date(iso)}`,
  on: (iso, o = {}) => (isMonthOnly(iso) ? inMonth(iso, { year: true, capital: o.capital }) : prepWith('il', iso, o)),
  from: (iso, o) => prepWith('dal', iso, o),
  to: (iso, o) => prepWith('al', iso, o),
  until: (iso, o = {}) => `${o.capital ? 'Fino' : 'fino'} ${elide('al', text(iso, o))}`,
  of: (iso, o) => prepWith('del', iso, o),
  inMonth,
  relativeDays(n) {
    if (n === 0) return 'oggi'
    if (n === 1) return 'domani'
    if (n === -1) return 'ieri'
    return n > 0 ? `tra ${n} giorni` : `${-n} giorni fa`
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
  ordinal(n, gender: Gender = 'f') {
    const word = (gender === 'f' ? ORD_F : ORD_M)[n]
    return word || `${n}${gender === 'f' ? 'ª' : 'º'}`
  },
  numberWord(n, gender: Gender = 'f') {
    return (gender === 'f' ? FEM : MASC)[n] ?? String(n)
  },
}
