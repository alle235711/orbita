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
    expect(diffDays('2026-12-14', '2027-02')).toBe(49)
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
    expect(isBetween('2026-12-14', '2026-12-14', '2027-01-24')).toBe(true)
    expect(isBetween('2027-01-24', '2026-12-14', '2027-01-24')).toBe(true)
    expect(isBetween('2027-01-25', '2026-12-14', '2027-01-24')).toBe(false)
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
    expect(formatShort('2026-12-14')).toBe('14 dic')
    expect(relativeDays(17)).toBe('tra 17 giorni')
    expect(relativeDays(1)).toBe('domani')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(90)).toBe('1 h 30')
    expect(formatMinutes(120)).toBe('2 h')
  })
})
