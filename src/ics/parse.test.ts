import { describe, expect, it } from 'vitest'
import { AppError } from '../i18n/errors'
import { db as realDb } from '../db/db'
import { cal } from './cal'
import { parseIcs } from './parse'
import { parseRRule } from './rrule'
import { parseContentLine, splitList, unescapeLine, unescapeText, unfoldLines } from './text'
import { addMonthsClamped, epochDay, fromEpochDay, instantToWall, isoWeekday, isValidZone, offsetAt, parseDuration, parseIcsValue, resolveZone, wallToInstant } from './time'

const code = (fn: () => unknown): string | undefined => {
  try {
    fn()
  } catch (e) {
    return e instanceof AppError ? e.code : 'other'
  }
  return undefined
}

describe('text', () => {
  it('riunisce le righe piegate togliendo un solo carattere', () => {
    expect(unfoldLines('SUMMARY:Fisica\r\n  Moderna\r\n\tX\r\n\r\nEND:X')).toEqual(['SUMMARY:Fisica ModernaX', 'END:X'])
  })
  it('accetta BOM, CRLF, LF e CR', () => {
    expect(unfoldLines('﻿A:1\r\nB:2\nC:3\rD:4')).toEqual(['A:1', 'B:2', 'C:3', 'D:4'])
  })
  it('legge nome, parametri con virgolette e valore', () => {
    const l = parseContentLine('DTSTART;TZID="Europe/Rome";X=a,"b,c":20261005T100000')!
    expect(l.name).toBe('DTSTART')
    expect(l.params.TZID).toEqual(['Europe/Rome'])
    expect(l.params.X).toEqual(['a', 'b,c'])
    expect(l.value).toBe('20261005T100000')
    expect(parseContentLine('summary;ALTREP="http://x:1/a;b":Ciao: mondo')!.value).toBe('Ciao: mondo')
    expect(parseContentLine('senza due punti')).toBeNull()
  })
  it('toglie le protezioni', () => {
    expect(unescapeText('a\\, b\\; c\\\\ d\\nE\\Nf\\x')).toBe('a, b; c\\ d\nE\nfx')
    expect(unescapeLine('Aula Magna\\nVia Inventata 1 ')).toBe('Aula Magna Via Inventata 1')
    expect(splitList('a, b,,c')).toEqual(['a', 'b', 'c'])
  })
})

describe('time', () => {
  it('date civili senza ora locale', () => {
    expect(epochDay('1970-01-02')).toBe(1)
    expect(fromEpochDay(epochDay('2027-03-28'))).toBe('2027-03-28')
    expect(isoWeekday(epochDay('2026-10-05'))).toBe(1)
    expect(isoWeekday(epochDay('2026-10-11'))).toBe(7)
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-09-01', 12)).toBe('2027-09-01')
  })
  it('fusi', () => {
    expect(isValidZone('Europe/Rome')).toBe(true)
    expect(isValidZone('Nowhere/Land')).toBe(false)
    expect(resolveZone('/freeassociation.sourceforge.net/Europe/Rome')).toBe('Europe/Rome')
    expect(resolveZone('W. Europe Standard Time')).toBeNull()
    expect(offsetAt('Europe/Rome', Date.UTC(2026, 6, 1))).toBe(7_200_000)
    expect(offsetAt('Europe/Rome', Date.UTC(2026, 11, 1))).toBe(3_600_000)
    expect(instantToWall('Europe/Rome', Date.UTC(2026, 9, 5, 8))).toEqual({ date: '2026-10-05', time: '10:00:00' })
  })
  it('passaggi di ora legale', () => {
    // ripetuta: la prima occorrenza (CEST)
    expect(new Date(wallToInstant('Europe/Rome', '2026-10-25', '02:30:00')).toISOString()).toBe('2026-10-25T00:30:00.000Z')
    // inesistente: offset di prima del salto
    expect(new Date(wallToInstant('Europe/Rome', '2027-03-28', '02:30:00')).toISOString()).toBe('2027-03-28T01:30:00.000Z')
    expect(new Date(wallToInstant('Europe/Rome', '2026-10-26', '10:00:00')).toISOString()).toBe('2026-10-26T09:00:00.000Z')
    expect(new Date(wallToInstant('Europe/Rome', '2026-10-24', '10:00:00')).toISOString()).toBe('2026-10-24T08:00:00.000Z')
  })
  it('valori', () => {
    expect(parseIcsValue('20261005', { VALUE: ['DATE'] })!.when).toEqual({ kind: 'date', date: '2026-10-05' })
    expect(parseIcsValue('20261005T1000', {})!.when).toEqual({ kind: 'floating', date: '2026-10-05', time: '10:00:00' })
    expect(parseIcsValue('20261005T080000Z', { TZID: ['Europe/Rome'] })!.when.kind).toBe('utc')
    expect(parseIcsValue('20261005T100000', { TZID: ['Europe/Rome'] })!.when).toMatchObject({ kind: 'zoned', tzid: 'Europe/Rome' })
    expect(parseIcsValue('20261005T100000', { TZID: ['Mars/Base'] })).toMatchObject({ unknownZone: true, when: { kind: 'floating' } })
    for (const bad of ['20261305', '20260431', '20261005T250000', 'ciao', '18990101T000000']) expect(parseIcsValue(bad, {})).toBeNull()
  })
  it('durate', () => {
    expect(parseDuration('PT1H30M')).toBe(5400)
    expect(parseDuration('P1W')).toBe(604800)
    expect(parseDuration('-P1DT2H')).toBe(-93600)
    expect(parseDuration('P')).toBeNull()
    expect(parseDuration('PT')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
  })
})

describe('rrule', () => {
  it('sottoinsieme supportato', () => {
    const r = parseRRule('FREQ=WEEKLY;BYDAY=we,MO,MO;INTERVAL=2;UNTIL=20270101T000000Z;WKST=SU')
    expect(r).toMatchObject({ ok: true, rule: { freq: 'WEEKLY', interval: 2, byDay: [1, 3], wkst: 7, until: { kind: 'utc' } } })
    expect(parseRRule('FREQ=DAILY;COUNT=5;BYDAY=MO,TU')).toMatchObject({ ok: true, rule: { count: 5 } })
  })
  it('non supportato, mai un crash', () => {
    for (const v of ['FREQ=MONTHLY;BYDAY=1MO', 'FREQ=YEARLY', 'FREQ=WEEKLY;BYDAY=-1FR', 'FREQ=DAILY;BYSETPOS=1', 'FREQ=WEEKLY;BYMONTH=3', 'FREQ=HOURLY', 'FREQ=WEEKLY;FOO=1'])
      expect(parseRRule(v)).toEqual({ ok: false, reason: 'unsupportedRule' })
  })
  it('malformato', () => {
    for (const v of ['BYDAY=MO', 'FREQ=WEEKLY;INTERVAL=0', 'FREQ=WEEKLY;COUNT=0', 'FREQ=WEEKLY;COUNT=2;COUNT=3', 'FREQ=WEEKLY;UNTIL=boh', 'FREQ=WEEKLY;X'])
      expect(parseRRule(v)).toEqual({ ok: false, reason: 'badEvent' })
  })
})

const ev = (extra: string[] = []) => ['UID:a@fake.test', 'SUMMARY:Fisica Moderna', 'DTSTART;TZID=Europe/Rome:20261005T100000', 'DTEND;TZID=Europe/Rome:20261005T120000', ...extra]

describe('parseIcs', () => {
  it('evento semplice', () => {
    const r = parseIcs(cal(ev(['LOCATION:Aula 3\\, Via Inventata', 'SEQUENCE:2'])))
    expect(r.events).toHaveLength(1)
    expect(r.events[0]).toMatchObject({ uid: 'a@fake.test', summary: 'Fisica Moderna', location: 'Aula 3, Via Inventata', sequence: 2, cancelled: false })
    expect(r.skipped).toEqual({ badEvent: 0, rdate: 0, unsupportedRule: 0, thisAndFuture: 0 })
  })
  it('ignora VTIMEZONE e VALARM', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Rome',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'END:DAYLIGHT',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      ...ev(),
      'BEGIN:VALARM',
      'SUMMARY:Sveglia',
      'DESCRIPTION:no',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const r = parseIcs(text)
    expect(r.events).toHaveLength(1)
    expect(r.events[0]!.summary).toBe('Fisica Moderna')
    expect(r.events[0]!.rrule).toBeUndefined()
  })
  it('conta gli eventi scartati una volta sola, con precedenza', () => {
    const r = parseIcs(
      cal(
        ev(['RDATE:20261201T100000Z', 'RRULE:FREQ=MONTHLY']),
        ['UID:b@fake.test', 'DTSTART:20261005T100000Z', 'RRULE:FREQ=MONTHLY;BYDAY=1MO'],
        ['UID:c@fake.test', 'DTSTART:boh'],
        ['SUMMARY:senza uid', 'DTSTART:20261005T100000Z'],
        ['UID:d@fake.test', 'DTSTART:20261005T100000Z', 'RECURRENCE-ID;RANGE=THISANDFUTURE:20261012T100000Z'],
        ['UID:e@fake.test', 'DTSTART:20261005T100000Z', 'EXRULE:FREQ=DAILY'],
        ['UID:f@fake.test', 'DTSTART:20261005T100000Z', 'RRULE:FREQ=WEEKLY;INTERVAL=0'],
      ),
    )
    expect(r.events).toHaveLength(0)
    expect(r.skipped).toEqual({ badEvent: 3, rdate: 1, unsupportedRule: 2, thisAndFuture: 1 })
    expect(r.skippedUids.sort()).toEqual(['a@fake.test', 'b@fake.test', 'c@fake.test', 'e@fake.test', 'f@fake.test'])
  })
  it('conta i fusi sconosciuti', () => {
    const r = parseIcs(cal(['UID:z@fake.test', 'DTSTART;TZID=W. Europe Standard Time:20261005T100000']))
    expect(r.warnings.unknownZone).toBe(1)
    expect(r.events[0]!.start.kind).toBe('floating')
  })
  it('doppioni: SEQUENCE più alto, a parità l\'ultimo', () => {
    const mk = (title: string, extra: string[] = []) => ['UID:a@fake.test', `SUMMARY:${title}`, 'DTSTART:20261005T100000Z', ...extra]
    const r = parseIcs(cal(mk('Vecchio', ['SEQUENCE:1']), mk('Nuovo', ['SEQUENCE:3']), mk('Medio', ['SEQUENCE:2'])))
    expect(r.events.map((e) => e.summary)).toEqual(['Nuovo'])
    const tie = parseIcs(cal(mk('Uno'), mk('Due')))
    expect(tie.events.map((e) => e.summary)).toEqual(['Due'])
  })
  it('EXDATE a liste e su più righe, override, annullato', () => {
    const r = parseIcs(
      cal(
        ev(['RRULE:FREQ=WEEKLY', 'EXDATE;TZID=Europe/Rome:20261012T100000,20261019T100000', 'EXDATE:20261026T090000Z', 'STATUS:cancelled']),
        ['UID:a@fake.test', 'DTSTART;TZID=Europe/Rome:20261013T100000', 'RECURRENCE-ID;TZID=Europe/Rome:20261012T100000'],
      ),
    )
    expect(r.events[0]!.exdates).toHaveLength(3)
    expect(r.events[0]!.cancelled).toBe(true)
    expect(r.events[1]!.recurrenceId).toMatchObject({ date: '2026-10-12' })
  })
  it('titolo assente', () => {
    expect(parseIcs(cal(['UID:q@fake.test', 'DTSTART:20261005T100000Z'])).events[0]!.summary).toBe('')
  })
  it('errori sul file', () => {
    expect(code(() => parseIcs(''))).toBe('icsNotCalendar')
    expect(code(() => parseIcs('{"a":1}'))).toBe('icsNotCalendar')
    expect(code(() => parseIcs('<html></html>'))).toBe('icsNotCalendar')
    expect(code(() => parseIcs('\u0000\u0001binario'))).toBe('icsNotCalendar')
    expect(code(() => parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a'))).toBe('icsTruncated')
    expect(code(() => parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nEND:VEVENT'))).toBe('icsTruncated')
    expect(code(() => parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:a\nEND:VCALENDAR'))).toBe('icsTruncated')
    expect(code(() => parseIcs('BEGIN:VCALENDAR\nEND:VCALENDAR'))).toBe('icsNoEvents')
    expect(parseIcs('﻿begin:vcalendar\nbegin:vevent\nuid:a\ndtstart:20261005T100000Z\nend:vevent\nend:vcalendar').events).toHaveLength(1)
  })
  it('non dipende dal fuso del dispositivo', () => {
    // Le funzioni usano solo Date.UTC e Intl: l'istante e il muro non cambiano con TZ.
    const when = new Date(wallToInstant('Europe/Rome', '2026-10-05', '10:00:00')).toISOString()
    expect(when).toBe('2026-10-05T08:00:00.000Z')
  })
})

describe('schema', () => {
  it('la tabella events non ha indici nuovi', () => {
    expect(realDb.events.schema.primKey.name).toBe('id')
    expect(realDb.events.schema.indexes.map((i) => i.name).sort()).toEqual(['date', 'updatedAt'])
  })
})
