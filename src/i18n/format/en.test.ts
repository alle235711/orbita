import { describe, expect, it } from 'vitest'
import { enFormat as f } from './en'

describe('enFormat', () => {
  it('date e preposizioni, senza elisione né ordinali', () => {
    expect(f.date('2026-11-13')).toBe('13 November')
    expect(f.date('2026-11-13', { year: true })).toBe('13 November 2026')
    expect(f.date('2027-02')).toBe('February 2027')
    expect(f.dateShort('2026-11-13')).toBe('13 Nov')
    expect(f.dateShort('2027-02')).toBe('Feb')
    expect(f.dateLong('2026-10-26')).toBe('Monday 26 October')
    expect(f.on('2026-11-08')).toBe('on 8 November')
    expect(f.on('2026-11-08', { capital: true, short: true })).toBe('On 8 Nov')
    expect(f.from('2026-01-11', { short: true })).toBe('from 11 Jan')
    expect(f.to('2026-04-24')).toBe('to 24 April')
    expect(f.until('2026-04-24')).toBe('until 24 April')
    expect(f.of('2026-04-24')).toBe('of 24 April')
    for (let d = 1; d <= 31; d++) expect(f.on(`2026-10-${String(d).padStart(2, '0')}`)).toBe(`on ${d} October`)
  })

  it('mesi', () => {
    expect(f.inMonth('2027-02')).toBe('in February')
    expect(f.inMonth('2027-02', { year: true })).toBe('in February 2027')
    expect(f.on('2027-02')).toBe('in February 2027')
    expect(f.monthShort(9)).toBe('Sep')
  })

  it('relativi, durate, numeri', () => {
    expect([0, 1, -1, 17, -3].map((n) => f.relativeDays(n))).toEqual(['today', 'tomorrow', 'yesterday', 'in 17 days', '3 days ago'])
    expect([45, 75, 120].map((n) => f.minutes(n))).toEqual(['45 min', '1 h 15', '2 h'])
    expect(f.hours(6.5)).toBe('6.5 h')
    expect([1, 0, 21].map((n) => f.count(n, 'day', 'days'))).toEqual(['1 day', '0 days', '21 days'])
  })

  it('ordinali 1..31 e numeri in lettere', () => {
    const exp = (n: number) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th')
    for (let n = 1; n <= 31; n++) expect(f.ordinal(n)).toBe(`${n}${exp(n)}`)
    expect(f.numberWord(3)).toBe('three')
    expect(f.numberWord(8)).toBe('8')
  })
})
