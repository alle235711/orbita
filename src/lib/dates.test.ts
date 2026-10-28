import { describe, expect, it } from 'vitest'
import {
  addDays,
  diffDays,
  formatDate,
  formatMinutes,
  formatShort,
  isBetween,
  rangeDays,
  relativeDays,
  resolveDate,
  toHHMM,
  toMinutes,
  weekday,
  weekStart,
  withDate,
} from './dates'

describe('date', () => {
  it('risolve le date con solo il mese al primo giorno', () => {
    expect(resolveDate('2027-02')).toBe('2027-02-01')
    expect(resolveDate('2026-11-13')).toBe('2026-11-13')
  })

  it('conta i giorni attraversando cambi di mese e ora legale', () => {
    expect(diffDays('2026-10-27', '2026-11-13')).toBe(17)
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2) // 25 ottobre: fine dell'ora legale
    expect(diffDays('2026-11-13', '2026-10-27')).toBe(-17)
    expect(diffDays('2026-12-10', '2027-02')).toBe(53)
  })

  it('somma i giorni', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('usa settimane da lunedì a domenica', () => {
    expect(weekday('2026-10-26')).toBe(1) // lunedì
    expect(weekday('2026-11-01')).toBe(7) // domenica
    expect(weekStart('2026-11-01')).toBe('2026-10-26')
    expect(weekStart('2026-10-29')).toBe('2026-10-26')
  })

  it('controlla gli intervalli con estremi compresi', () => {
    expect(isBetween('2027-03-15', '2027-03-15', '2027-04-24')).toBe(true)
    expect(isBetween('2027-04-24', '2027-03-15', '2027-04-24')).toBe(true)
    expect(isBetween('2027-04-25', '2027-03-15', '2027-04-24')).toBe(false)
    expect(rangeDays('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('converte gli orari', () => {
    expect(toMinutes('9:00')).toBe(540)
    expect(toMinutes('18:30')).toBe(1110)
    expect(toHHMM(1110)).toBe('18:30')
    expect(toHHMM(545)).toBe('9:05')
  })

  it('formatta in italiano', () => {
    expect(formatDate('2026-11-13')).toBe('13 novembre')
    expect(formatDate('2027-02')).toBe('febbraio 2027')
    expect(formatShort('2027-07')).toBe('lug')
    expect(formatShort('2026-12-10')).toBe('10 dic')
    expect(relativeDays(17)).toBe('tra 17 giorni')
    expect(relativeDays(1)).toBe('domani')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(90)).toBe('1 h 30')
    expect(formatMinutes(120)).toBe('2 h')
  })
})

describe('withDate: articolo davanti alla data', () => {
  it('elide davanti a 8 e 11', () => {
    expect(withDate('il', formatDate('2026-11-08'))).toBe('l’8 novembre')
    expect(withDate('il', formatDate('2026-11-11'))).toBe('l’11 novembre')
    expect(withDate('dal', formatShort('2026-11-11'))).toBe('dall’11 nov')
    expect(withDate('al', '8 marzo')).toBe('all’8 marzo')
    expect(withDate('del', '8 marzo')).toBe('dell’8 marzo')
    expect(withDate('nel', '8 marzo')).toBe('nell’8 marzo')
    expect(withDate('sul', '8 marzo')).toBe('sull’8 marzo')
  })

  it('non elide negli altri casi', () => {
    expect(withDate('il', formatDate('2026-11-18'))).toBe('il 18 novembre')
    expect(withDate('il', formatDate('2027-03-01'))).toBe('il 1 marzo')
    expect(withDate('il', formatDate('2026-11-13'))).toBe('il 13 novembre')
    expect(withDate('il', formatDate('2026-11-28'))).toBe('il 28 novembre')
    expect(withDate('a', formatDate('2027-02'))).toBe('a febbraio 2027')
    expect(withDate('il', 'febbraio 2027')).toBe('il febbraio 2027')
  })

  it('mantiene la maiuscola', () => {
    expect(withDate('Il', '8 novembre')).toBe('L’8 novembre')
    expect(withDate('Dal', '11 gen')).toBe('Dall’11 gen')
    expect(withDate('Il', '13 novembre')).toBe('Il 13 novembre')
  })
})
