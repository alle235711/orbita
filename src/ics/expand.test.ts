import { describe, expect, it } from 'vitest'
import { expandIcs } from './expand'
import { parseIcs } from './parse'
import { academicWindow } from './window'
import { cal } from './cal'

const WIN = { from: '2026-09-01', to: '2027-08-31' }
const run = (text: string, displayZone = 'Europe/Rome', window = WIN) => expandIcs(parseIcs(text), { window, displayZone })
const weekly = (rule: string, extra: string[] = [], start = '20261005T100000', end = '20261005T120000') => [
  'UID:fis@fake.test',
  'SUMMARY:Fisica Moderna',
  `DTSTART;TZID=Europe/Rome:${start}`,
  `DTEND;TZID=Europe/Rome:${end}`,
  `RRULE:${rule}`,
  ...extra,
]
const dates = (text: string, zone?: string, window?: typeof WIN) => run(text, zone, window).occurrences.map((o) => o.date)

describe('academicWindow', () => {
  it('esempi della specifica', () => {
    expect(academicWindow('09-01', '2026-10-29')).toEqual({ from: '2026-09-01', to: '2027-08-31' })
    expect(academicWindow('09-01', '2026-08-31')).toEqual({ from: '2025-09-01', to: '2026-08-31' })
    expect(academicWindow('09-01', '2026-09-01')).toEqual({ from: '2026-09-01', to: '2027-08-31' })
    expect(academicWindow('02-01', '2026-01-15')).toEqual({ from: '2025-02-01', to: '2026-01-31' })
  })
  it('valori non validi tornano a 09-01', () => {
    for (const bad of ['', '9-1', '13-01', '02-29', '04-31', 'xx-yy']) expect(academicWindow(bad, '2026-10-29').from).toBe('2026-09-01')
  })
})

describe('espansione', () => {
  it('evento singolo, ora di Roma', () => {
    const r = run(cal(['UID:a@fake.test', 'SUMMARY:Algebra Superiore', 'DTSTART;TZID=Europe/Rome:20261005T100000', 'DTEND;TZID=Europe/Rome:20261005T113000']))
    expect(r.occurrences).toEqual([
      expect.objectContaining({ id: 'ics:a@fake.test:20261005T080000Z', date: '2026-10-05', start: '10:00', end: '11:30', allDay: false, moved: false }),
    ])
    expect(r.series).toEqual([{ uid: 'a@fake.test', summary: 'Algebra Superiore', cancelled: false, occurrences: 1 }])
  })
  it('settimanale resta alle 10 a Roma attraverso l\'ora legale, l\'UTC si muove', () => {
    const r = run(cal(weekly('FREQ=WEEKLY;COUNT=4')))
    expect(r.occurrences.map((o) => [o.date, o.start, o.key])).toEqual([
      ['2026-10-05', '10:00', '20261005T080000Z'],
      ['2026-10-12', '10:00', '20261012T080000Z'],
      ['2026-10-19', '10:00', '20261019T080000Z'],
      ['2026-10-26', '10:00', '20261026T090000Z'],
    ])
  })
  it('master UTC recita in UTC: a Roma si sposta di un\'ora', () => {
    const r = run(cal(['UID:u@fake.test', 'DTSTART:20261019T080000Z', 'DTEND:20261019T100000Z', 'RRULE:FREQ=WEEKLY;COUNT=2']))
    expect(r.occurrences.map((o) => o.start)).toEqual(['10:00', '09:00'])
  })
  it('ore inesistenti e ripetute', () => {
    expect(run(cal(['UID:g@fake.test', 'DTSTART;TZID=Europe/Rome:20270328T023000', 'DTEND;TZID=Europe/Rome:20270328T033000'])).occurrences[0]).toMatchObject({ start: '03:30', key: '20270328T013000Z' })
    expect(run(cal(['UID:r@fake.test', 'DTSTART;TZID=Europe/Rome:20261025T023000', 'DTEND;TZID=Europe/Rome:20261025T033000'])).occurrences[0]).toMatchObject({ key: '20261025T003000Z' })
  })
  it('floating usa l\'ora scritta qualunque sia il fuso di visualizzazione', () => {
    const t = cal(['UID:f@fake.test', 'DTSTART:20261005T100000', 'DTEND:20261005T120000'])
    expect(run(t, 'America/Los_Angeles').occurrences[0]).toMatchObject({ start: '10:00', end: '12:00', key: '20261005T100000' })
  })
  it('fuso di visualizzazione diverso converte', () => {
    expect(run(cal(weekly('FREQ=WEEKLY;COUNT=1')), 'UTC').occurrences[0]).toMatchObject({ start: '08:00', end: '10:00' })
    expect(run(cal(weekly('FREQ=WEEKLY;COUNT=1')), 'Nowhere/Land').occurrences[0]!.start).toBe('08:00')
  })
  it('BYDAY + UNTIL inclusivo in tutte le forme', () => {
    const base = ['UID:b@fake.test', 'DTSTART;TZID=Europe/Rome:20261005T100000', 'DTEND;TZID=Europe/Rome:20261005T120000']
    const mk = (until: string) => [...base, `RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=${until}`]
    const want = ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']
    expect(dates(cal(mk('20261014'))).slice()).toEqual(want)
    expect(dates(cal(mk('20261014T100000'))).slice()).toEqual(want)
    expect(dates(cal(mk('20261014T080000Z'))).slice()).toEqual(want)
    expect(dates(cal(mk('20261014T075959Z'))).slice()).toEqual(want.slice(0, 3))
  })
  it('COUNT conta anche le occorrenze poi escluse', () => {
    const t = cal(weekly('FREQ=WEEKLY;COUNT=3', ['EXDATE;TZID=Europe/Rome:20261012T100000']))
    expect(dates(t)).toEqual(['2026-10-05', '2026-10-19'])
  })
  it('INTERVAL=2 con WKST=MO e WKST=SU', () => {
    const t = (wkst: string) => cal(weekly(`FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO;WKST=${wkst};COUNT=4`, [], '20261004T100000', '20261004T120000'))
    // 2026-10-04 è domenica. WKST=MO: settimana di lun 28/9; domenica 4/10 è l'ultimo giorno della sua settimana, poi si salta a 12/10 (lun) e 18/10 (dom).
    expect(dates(t('MO'))).toEqual(['2026-10-04', '2026-10-12', '2026-10-18', '2026-10-26'])
    // WKST=SU: la settimana parte da dom 4/10: dom 4, lun 5; si salta a dom 18, lun 19.
    expect(dates(t('SU'))).toEqual(['2026-10-04', '2026-10-05', '2026-10-18', '2026-10-19'])
  })
  it('DTSTART fuori da BYDAY non è un\'occorrenza', () => {
    expect(dates(cal(weekly('FREQ=WEEKLY;BYDAY=WE;COUNT=2')))).toEqual(['2026-10-07', '2026-10-14'])
  })
  it('DAILY: count, interval, until, filtro BYDAY', () => {
    expect(dates(cal(weekly('FREQ=DAILY;COUNT=3'))))
      .toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(dates(cal(weekly('FREQ=DAILY;INTERVAL=3;COUNT=3')))).toEqual(['2026-10-05', '2026-10-08', '2026-10-11'])
    expect(dates(cal(weekly('FREQ=DAILY;UNTIL=20261007')))).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(dates(cal(weekly('FREQ=DAILY;BYDAY=MO,FR;COUNT=3')))).toEqual(['2026-10-05', '2026-10-09', '2026-10-12'])
  })
  it('serie aperta da molto lontano: veloce ed esatta', () => {
    const t = cal(weekly('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU', [], '20100105T100000', '20100105T120000'))
    const t0 = performance.now()
    const r = run(t)
    expect(performance.now() - t0).toBeLessThan(200)
    // 2010-01-05 + 14k giorni: la fase deve essere conservata (stessa parità di settimana)
    expect(r.occurrences.length).toBeGreaterThan(20)
    for (const o of r.occurrences) expect(((Date.parse(o.date) - Date.parse('2010-01-05')) / 86_400_000) % 14).toBe(0)
    expect(r.occurrences.every((o) => o.date >= WIN.from && o.date <= WIN.to)).toBe(true)
  })
  it('EXDATE: singolo, lista, UTC, DATE, senza corrispondenza', () => {
    const rule = 'FREQ=WEEKLY;COUNT=5'
    expect(dates(cal(weekly(rule, ['EXDATE;TZID=Europe/Rome:20261012T100000,20261019T100000'])))).toEqual(['2026-10-05', '2026-10-26', '2026-11-02'])
    expect(dates(cal(weekly(rule, ['EXDATE:20261012T080000Z'])))).toHaveLength(4)
    expect(dates(cal(weekly(rule, ['EXDATE;VALUE=DATE:20261012'])))).toHaveLength(4)
    expect(dates(cal(weekly(rule, ['EXDATE;TZID=Europe/Rome:20261012T110000'])))).toHaveLength(5)
    expect(dates(cal(weekly(rule, ['EXDATE;TZID=Europe/Rome:20261012T100000', 'EXDATE;TZID=Europe/Rome:20261019T100000'])))).toHaveLength(3)
  })
  it('eccezione spostata: id invariato, luogo nuovo, titolo ereditato', () => {
    const t = cal(weekly('FREQ=WEEKLY;COUNT=3', ['LOCATION:Aula 1']), [
      'UID:fis@fake.test',
      'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000',
      'DTSTART;TZID=Europe/Rome:20261013T150000',
      'DTEND;TZID=Europe/Rome:20261013T170000',
      'LOCATION:Aula 9',
    ])
    const moved = run(t).occurrences.find((o) => o.moved)!
    expect(moved).toMatchObject({ id: 'ics:fis@fake.test:20261012T080000Z', date: '2026-10-13', start: '15:00', end: '17:00', location: 'Aula 9', summary: 'Fisica Moderna' })
    expect(run(t).occurrences.find((o) => !o.moved)!.location).toBe('Aula 1')
  })
  it('eccezione annullata toglie l\'occorrenza, anche se in EXDATE vince l\'eccezione', () => {
    const cancelled = cal(weekly('FREQ=WEEKLY;COUNT=3'), ['UID:fis@fake.test', 'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000', 'DTSTART;TZID=Europe/Rome:20261012T100000', 'STATUS:CANCELLED'])
    expect(dates(cancelled)).toEqual(['2026-10-05', '2026-10-19'])
    const both = cal(weekly('FREQ=WEEKLY;COUNT=3', ['EXDATE;TZID=Europe/Rome:20261012T100000']), [
      'UID:fis@fake.test',
      'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000',
      'DTSTART;TZID=Europe/Rome:20261012T140000',
      'DTEND;TZID=Europe/Rome:20261012T160000',
    ])
    expect(run(both).occurrences.map((o) => o.start)).toEqual(['10:00', '14:00', '10:00'])
  })
  it('master annullato: niente occorrenze, la serie resta; eccezioni attive restano', () => {
    const t = cal(weekly('FREQ=WEEKLY;COUNT=3', ['STATUS:CANCELLED']), [
      'UID:fis@fake.test',
      'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000',
      'DTSTART;TZID=Europe/Rome:20261012T140000',
      'DTEND;TZID=Europe/Rome:20261012T160000',
    ])
    const r = run(t)
    expect(r.series[0]).toMatchObject({ uid: 'fis@fake.test', cancelled: true, occurrences: 1 })
    expect(r.occurrences).toHaveLength(1)
    expect(run(cal(weekly('FREQ=WEEKLY;COUNT=3', ['STATUS:CANCELLED']))).occurrences).toHaveLength(0)
  })
  it('eccezione orfana (senza master) si importa da sola', () => {
    const r = run(cal(['UID:o@fake.test', 'SUMMARY:Calcolo Numerico', 'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000', 'DTSTART;TZID=Europe/Rome:20261012T140000', 'DTEND;TZID=Europe/Rome:20261012T160000']))
    expect(r.occurrences[0]).toMatchObject({ id: 'ics:o@fake.test:20261012T080000Z', start: '14:00', moved: true })
    expect(r.series[0]!.summary).toBe('Calcolo Numerico')
  })
  it('master scartato porta con sé le eccezioni', () => {
    const t = cal(
      ['UID:m@fake.test', 'DTSTART:20261005T100000Z', 'RRULE:FREQ=MONTHLY;BYDAY=1MO'],
      ['UID:m@fake.test', 'RECURRENCE-ID:20261005T100000Z', 'DTSTART:20261006T100000Z'],
    )
    const r = run(t)
    expect(r.occurrences).toHaveLength(0)
    expect(r.series).toHaveLength(0)
  })
  it('tutto il giorno: contato, non importato', () => {
    const r = run(cal(['UID:d@fake.test', 'DTSTART;VALUE=DATE:20261005', 'DTEND;VALUE=DATE:20261006', 'SUMMARY:Festa']))
    expect(r.occurrences).toHaveLength(0)
    expect(r.stats.allDay).toBe(1)
    expect(r.series).toHaveLength(1)
  })
  it('fine il giorno dopo: tagliata alle 23:59', () => {
    const r = run(cal(['UID:n@fake.test', 'DTSTART;TZID=Europe/Rome:20261005T220000', 'DTEND;TZID=Europe/Rome:20261006T020000']))
    expect(r.occurrences[0]).toMatchObject({ end: '23:59', endClamped: true })
    const z = run(cal(['UID:z@fake.test', 'DTSTART;TZID=Europe/Rome:20261005T100000']))
    expect(z.occurrences[0]).toMatchObject({ start: '10:00', end: '10:00', endClamped: false })
    const d = run(cal(['UID:y@fake.test', 'DTSTART;TZID=Europe/Rome:20261005T100000', 'DURATION:PT90M']))
    expect(d.occurrences[0]!.end).toBe('11:30')
  })
  it('bordi della finestra, inclusivi', () => {
    const t = cal(weekly('FREQ=DAILY;COUNT=400', [], '20260830T100000', '20260830T110000'))
    const o = run(t).occurrences
    expect(o[0]!.date).toBe('2026-09-01')
    expect(o[o.length - 1]!.date).toBe('2027-08-31')
    expect(run(t, 'Europe/Rome', { from: '2026-09-03', to: '2026-09-04' }).occurrences.map((x) => x.date)).toEqual(['2026-09-03', '2026-09-04'])
  })
  it('limiti: troppe occorrenze scartano la serie intera', () => {
    const r = run(cal(weekly('FREQ=DAILY;INTERVAL=1', [], '20260901T100000', '20260901T100100').concat([]), ['UID:ok@fake.test', 'DTSTART:20261005T100000Z']), 'Europe/Rome', { from: '2026-01-01', to: '2030-12-31' })
    expect(r.stats.tooMany).toBe(1)
    expect(r.series.map((s) => s.uid)).toEqual(['ok@fake.test'])
    expect(r.occurrences).toHaveLength(1)
  })
  it('occorrenze deduplicate e ordinate', () => {
    const t = cal(
      ['UID:b@fake.test', 'DTSTART:20261005T090000Z', 'SUMMARY:B'],
      ['UID:a@fake.test', 'DTSTART:20261005T090000Z', 'SUMMARY:A'],
      ['UID:c@fake.test', 'DTSTART:20261004T090000Z', 'SUMMARY:C'],
    )
    expect(run(t, 'UTC').occurrences.map((o) => o.uid)).toEqual(['c@fake.test', 'a@fake.test', 'b@fake.test'])
  })
})
