import type { ISODate } from '../../lib/dates'
import type { Lang } from '../lang'

export interface DateOpts {
  /** Mese breve ('13 nov') invece di quello esteso. */
  short?: boolean
  /** Aggiunge l'anno (solo forma estesa; le date con solo il mese lo portano sempre). */
  year?: boolean
  /** Preposizione con l'iniziale maiuscola ('Il 8 novembre', 'On 8 November'). */
  capital?: boolean
}
export type Gender = 'f' | 'm'

export interface Format {
  readonly lang: Lang
  readonly locale: string
  /** 1..12 */
  monthName(month: number): string
  monthShort(month: number): string
  /** 1 = lunedì … 7 = domenica */
  weekdayName(day: number): string
  weekdayShort(day: number): string
  /** '2026-11-13' → '13 novembre'; con anno '13 novembre 2026'; '2027-02' → 'febbraio 2027'. */
  date(iso: string, o?: { year?: boolean }): string
  /** '2026-11-13' → '13 nov'; '2027-02' → 'feb'. */
  dateShort(iso: string): string
  /** Giorno della settimana e data: 'lunedì 26 ottobre' / 'Monday 26 October'. */
  dateLong(iso: ISODate): string
  /** Preposizione e data. Con 'YYYY-MM' passa a inMonth(iso, { year: true, capital }). */
  on(iso: string, o?: DateOpts): string
  from(iso: string, o?: DateOpts): string
  to(iso: string, o?: DateOpts): string
  until(iso: string, o?: DateOpts): string
  of(iso: string, o?: DateOpts): string
  /** Solo il mese, con la preposizione: 'a febbraio', 'ad aprile' / 'in February'. */
  inMonth(iso: string, o?: { year?: boolean; capital?: boolean }): string
  relativeDays(n: number): string
  /** 75 → '1 h 15', 45 → '45 min', 120 → '2 h' */
  minutes(n: number): string
  /** Arrotonda alla mezz'ora, poi number() + ' h'. */
  hours(h: number): string
  number(n: number, digits?: number): string
  plural(n: number, one: string, other: string): string
  count(n: number, one: string, other: string): string
  ordinal(n: number, gender?: Gender): string
  numberWord(n: number, gender?: Gender): string
}
