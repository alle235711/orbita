import { describe, expect, it } from 'vitest'
import { elide, itFormat as f } from './it'

describe('elide', () => {
  it('elide davanti a 8 e 11, per tutte le preposizioni', () => {
    for (const [prep, stem] of [['il', 'l'], ['dal', 'dall'], ['al', 'all'], ['del', 'dell'], ['nel', 'nell'], ['sul', 'sull']] as const) {
      expect(elide(prep, '8 novembre')).toBe(`${stem}’8 novembre`)
      expect(elide(prep, '11 gen')).toBe(`${stem}’11 gen`)
      expect(elide(prep, '18 novembre')).toBe(`${prep} 18 novembre`)
      const cap = prep[0]!.toUpperCase() + prep.slice(1)
      expect(elide(cap, '8 novembre')).toBe(`${stem[0]!.toUpperCase() + stem.slice(1)}’8 novembre`)
    }
  })
})

describe('itFormat', () => {
  it('date e preposizioni per tutti i giorni di un mese', () => {
    for (let d = 1; d <= 31; d++) {
      const iso = `2026-10-${String(d).padStart(2, '0')}`
      const t = `${d} ottobre`
      const el = d === 8 || d === 11
      expect(f.on(iso)).toBe(el ? `l’${t}` : `il ${t}`)
      expect(f.from(iso)).toBe(el ? `dall’${t}` : `dal ${t}`)
      expect(f.to(iso)).toBe(el ? `all’${t}` : `al ${t}`)
      expect(f.of(iso)).toBe(el ? `dell’${t}` : `del ${t}`)
      expect(f.until(iso)).toBe(el ? `fino all’${t}` : `fino al ${t}`)
      expect(f.on(iso, { capital: true })).toBe(el ? `L’${t}` : `Il ${t}`)
      expect(f.until(iso, { capital: true })).toBe(el ? `Fino all’${t}` : `Fino al ${t}`)
    }
  })

  it('casi del mockup', () => {
    expect(f.date('2026-11-13')).toBe('13 novembre')
    expect(f.date('2026-11-13', { year: true })).toBe('13 novembre 2026')
    expect(f.date('2027-02')).toBe('febbraio 2027')
    expect(f.dateShort('2026-11-13')).toBe('13 nov')
    expect(f.dateShort('2027-02')).toBe('feb')
    expect(f.dateLong('2026-10-26')).toBe('lunedì 26 ottobre')
    expect(f.from('2026-01-11', { short: true })).toBe('dall’11 gen')
    expect(f.on('2026-03-01')).toBe('il 1 marzo')
    expect(f.on('2027-02')).toBe('a febbraio 2027')
  })

  it('a/ad davanti ai mesi', () => {
    for (let m = 1; m <= 12; m++) {
      const name = f.monthName(m)
      const prep = name.startsWith('a') ? 'ad' : 'a'
      const iso = `2027-${String(m).padStart(2, '0')}`
      expect(f.inMonth(iso)).toBe(`${prep} ${name}`)
      expect(f.inMonth(`${iso}-15`, { year: true, capital: true })).toBe(`${prep[0]!.toUpperCase()}${prep.slice(1)} ${name} 2027`)
    }
    expect(f.inMonth('2027-04')).toBe('ad aprile')
    expect(f.inMonth('2027-08')).toBe('ad agosto')
    expect(f.inMonth('2027-07')).toBe('a luglio')
  })

  it('relativi, durate e numeri', () => {
    expect([0, 1, -1, 17, -3].map((n) => f.relativeDays(n))).toEqual(['oggi', 'domani', 'ieri', 'tra 17 giorni', '3 giorni fa'])
    expect([45, 75, 120].map((n) => f.minutes(n))).toEqual(['45 min', '1 h 15', '2 h'])
    expect(f.hours(6.5)).toBe('6,5 h')
    expect(f.hours(6.7)).toBe('6,5 h')
    expect(f.number(6.5)).toBe('6,5')
  })

  it('plurali, ordinali e numeri in lettere', () => {
    expect([0, 1, 2, 11, 21, 101].map((n) => f.count(n, 'giorno', 'giorni'))).toEqual(['0 giorni', '1 giorno', '2 giorni', '11 giorni', '21 giorni', '101 giorni'])
    expect(f.ordinal(2)).toBe('seconda')
    expect(f.ordinal(2, 'm')).toBe('secondo')
    expect(f.ordinal(8)).toBe('8ª')
    expect(f.ordinal(8, 'm')).toBe('8º')
    expect(f.numberWord(1)).toBe('una')
    expect(f.numberWord(1, 'm')).toBe('uno')
    expect(f.numberWord(9)).toBe('9')
  })
})
