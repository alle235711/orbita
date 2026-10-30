import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type OrbitaDB } from '../db/db'
import { loadRuleContext } from '../db/plan-context'
import { patch, remove } from '../db/repo'
import type { CalendarEvent, Course } from '../db/schema'
import { AppError } from '../i18n/errors'
import { applyIcsPlan } from './apply'
import { cal } from './cal'
import { expandIcs } from './expand'
import { hiddenCourseIds, isHiddenLesson, withoutHiddenLessons } from './hide'
import { buildGroups, defaultMapping, proposeMapping, type IcsMapping } from './mapping'
import { parseIcs } from './parse'
import { planIcsImport } from './plan'
import { previewIcs } from './preview'
import { MAX_ICS_BYTES, readIcsFile } from './read'

const WINDOW = { from: '2026-09-01', to: '2027-08-31' }
const course = (id: string, name: string, extra: Partial<Course> = {}): Course => ({ id, name, sections: [], difficulty: 2, updatedAt: 0, ...extra })
const COURSES = [course('fis', 'Fisica Moderna'), course('calc', 'Calcolo Numerico'), course('alg', 'Algebra Superiore', { code: 'ALG-101' })]

const fisica = (extra: string[] = [], count = 3) => [
  'UID:fis@fake.test',
  'SUMMARY:Fisica Moderna',
  'DTSTART;TZID=Europe/Rome:20261005T100000',
  'DTEND;TZID=Europe/Rome:20261005T120000',
  `RRULE:FREQ=WEEKLY;COUNT=${count}`,
  ...extra,
]
const seminario = ['UID:sem@fake.test', 'SUMMARY:Seminario Fittizio', 'DTSTART;TZID=Europe/Rome:20261006T160000', 'DTEND;TZID=Europe/Rome:20261006T170000']
const expand = (text: string) => expandIcs(parseIcs(text), { window: WINDOW, displayZone: 'Europe/Rome' })
const map = (entries: [string, IcsMapping extends ReadonlyMap<string, infer T> ? T : never][]): IcsMapping => new Map(entries)
const toFis: IcsMapping = map([['Fisica Moderna', { kind: 'course', courseId: 'fis' }]])

describe('mapping', () => {
  it('propone dal codice, dal nome ignorando le parentesi e dall\'importazione precedente', () => {
    const prev: CalendarEvent[] = [{ id: 'ics:x:1', uid: 'x', source: 'ics', title: 'Titolo Strano', courseId: 'calc', date: '2026-10-01', start: '10:00', end: '11:00', type: 'lezione', suggested: false, confirmed: true, updatedAt: 1 }]
    const p = proposeMapping(['Laboratorio ALG-101', 'Calcolo Numerico (Prof. Inventato)', 'Titolo Strano', 'Seminario Fittizio', 'Fisica Moderna'], COURSES, prev)
    expect(p.get('Laboratorio ALG-101')).toMatchObject({ courseId: 'alg', by: 'code' })
    expect(p.get('Calcolo Numerico (Prof. Inventato)')).toMatchObject({ courseId: 'calc', by: 'name' })
    expect(p.get('Titolo Strano')).toMatchObject({ courseId: 'calc', by: 'previous' })
    expect(p.get('Seminario Fittizio')).toBeNull()
    expect(p.get('Fisica Moderna')).toMatchObject({ courseId: 'fis', by: 'name', score: 1 })
  })
  it('il codice vale solo come parole intere; vince il più lungo', () => {
    const cs = [course('a', 'Uno', { code: 'AL' }), course('b', 'Due', { code: 'AL 2' })]
    const p = proposeMapping(['Lezione AL 2 aula', 'Lezione ALG'], cs, [])
    expect(p.get('Lezione AL 2 aula')?.courseId).toBe('b')
    expect(p.get('Lezione ALG')).toBeNull()
  })
  it('gruppi ordinati per prima data, mapping predefinito dalle proposte', () => {
    const e = expand(cal(seminario, fisica()))
    const groups = buildGroups(e, COURSES, [])
    expect(groups.map((g) => [g.summary, g.lessons, g.first, g.last])).toEqual([
      ['Fisica Moderna', 3, '2026-10-05', '2026-10-19'],
      ['Seminario Fittizio', 1, '2026-10-06', '2026-10-06'],
    ])
    const m = defaultMapping(groups)
    expect(m.get('Fisica Moderna')).toEqual({ kind: 'course', courseId: 'fis' })
    expect(m.get('Seminario Fittizio')).toEqual({ kind: 'none' })
  })
})

describe('planIcsImport (puro)', () => {
  it('primo import aggiunge tutto, ordinato', () => {
    const plan = planIcsImport([], expand(cal(seminario, fisica())), toFis)
    expect(plan.add.map((r) => r.id)).toEqual([
      'ics:fis@fake.test:20261005T080000Z',
      'ics:sem@fake.test:20261006T140000Z',
      'ics:fis@fake.test:20261012T080000Z',
      'ics:fis@fake.test:20261019T080000Z',
    ])
    expect(plan.add[0]).toEqual({ id: 'ics:fis@fake.test:20261005T080000Z', date: '2026-10-05', start: '10:00', end: '12:00', title: 'Fisica Moderna', type: 'lezione', suggested: false, confirmed: true, courseId: 'fis', source: 'ics', uid: 'fis@fake.test' })
    expect(plan.add[1]).not.toHaveProperty('courseId')
  })
  it('titolo assente usa il segnaposto', () => {
    const e = expand(cal(['UID:q@fake.test', 'DTSTART:20261005T100000Z']))
    expect(planIcsImport([], e, new Map(), 'Lezione').add[0]!.title).toBe('Lezione')
  })
  it('skip esclude righe e serie', () => {
    const plan = planIcsImport([], expand(cal(fisica())), map([['Fisica Moderna', { kind: 'skip' }]]))
    expect(plan.add).toHaveLength(0)
  })
})

describe('importazione sul database', () => {
  let db: OrbitaDB
  beforeEach(() => {
    db = createDb(`test-${crypto.randomUUID()}`)
  })
  afterEach(async () => {
    await db.delete()
  })
  const run = async (text: string, mapping: IcsMapping = toFis) => {
    const plan = planIcsImport(await db.events.toArray(), expand(text), mapping)
    const res = await applyIcsPlan(db, plan)
    return { plan, res }
  }
  const alive = async () => (await db.events.toArray()).filter((e) => !e.deletedAt)

  it('importa, reimporta senza cambiare niente', async () => {
    const first = await run(cal(fisica()))
    expect(first.res).toEqual({ added: 3, updated: 0, removed: 0 })
    const rows = await alive()
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.updatedAt > 0 && r.source === 'ics')).toBe(true)
    const second = await run(cal(fisica()))
    expect(second.plan).toMatchObject({ add: [], update: [], remove: [], unchanged: 3 })
    expect(await db.events.count()).toBe(3)
  })
  it('un file modificato aggiorna e toglie solo dentro la finestra', async () => {
    await run(cal(fisica()))
    const changed = fisica([], 2)
    changed[3] = 'DTEND;TZID=Europe/Rome:20261005T123000'
    const { plan, res } = await run(cal(changed))
    expect(plan.update.map((u) => u.changes)).toEqual([{ end: '12:30' }, { end: '12:30' }])
    expect(res).toEqual({ added: 0, updated: 2, removed: 1 })
    const all = await db.events.toArray()
    expect(all).toHaveLength(3)
    expect(all.filter((e) => e.deletedAt)).toHaveLength(1)
  })
  it('un evento fuori dalla finestra non si tocca', async () => {
    await db.events.put({ id: 'ics:fis@fake.test:20250101T080000Z', uid: 'fis@fake.test', source: 'ics', date: '2025-01-01', start: '10:00', end: '11:00', title: 'Vecchia', type: 'lezione', suggested: false, confirmed: true, updatedAt: 1 })
    const { plan } = await run(cal(fisica()))
    expect(plan.remove).toEqual([])
    expect((await db.events.get('ics:fis@fake.test:20250101T080000Z'))!.deletedAt).toBeUndefined()
  })
  it('la modifica dell\'utente resta; quella cancellata non risorge', async () => {
    await run(cal(fisica()))
    const [a, b] = ['ics:fis@fake.test:20261005T080000Z', 'ics:fis@fake.test:20261012T080000Z']
    await patch(db.events, a!, { title: 'La mia', userEdited: true })
    await patch(db.events, b!, { userEdited: true })
    await remove(db.events, b!)
    const changed = fisica()
    changed[3] = 'DTEND;TZID=Europe/Rome:20261005T130000'
    const { plan } = await run(cal(changed))
    expect(plan.keptEdited).toBe(2)
    expect(plan.update.map((u) => u.id)).toEqual(['ics:fis@fake.test:20261019T080000Z'])
    expect((await db.events.get(a!))!.title).toBe('La mia')
    expect((await db.events.get(b!))!.deletedAt).toBeGreaterThan(0)
    // anche tolta dal file, l'utente la tiene
    const { plan: gone } = await run(cal(fisica([], 1)))
    expect(gone.remove).toEqual(['ics:fis@fake.test:20261019T080000Z'])
    expect(gone.keptEdited).toBe(1)
  })
  it('una riga tolta da un\'importazione precedente torna se il file la rivuole', async () => {
    await run(cal(fisica()))
    await run(cal(fisica([], 2)))
    expect((await alive()).length).toBe(2)
    const back = await run(cal(fisica()))
    expect(back.res.added).toBe(1)
    const row = await db.events.get('ics:fis@fake.test:20261019T080000Z')
    expect(row!.deletedAt).toBeUndefined()
  })
  it('"Non importare" lascia le righe com\'erano; il secondo corso di laurea non cancella il primo', async () => {
    await run(cal(fisica(), seminario), map([['Fisica Moderna', { kind: 'course', courseId: 'fis' }]]))
    const before = (await alive()).length
    const skipped = await run(cal(seminario), map([['Seminario Fittizio', { kind: 'skip' }]]))
    expect(skipped.plan.remove).toEqual([])
    const other = await run(cal(['UID:alt@fake.test', 'SUMMARY:Altro Corso', 'DTSTART;TZID=Europe/Rome:20261007T100000', 'DTEND;TZID=Europe/Rome:20261007T110000']), new Map())
    expect(other.plan.remove).toEqual([])
    expect((await alive()).length).toBe(before + 1)
  })
  it('un master annullato toglie le sue righe', async () => {
    await run(cal(fisica()))
    const { res } = await run(cal(fisica(['STATUS:CANCELLED'])))
    expect(res.removed).toBe(3)
  })
  it('cambiare corso nell\'abbinamento aggiorna il courseId', async () => {
    await run(cal(fisica()))
    const { plan } = await run(cal(fisica()), map([['Fisica Moderna', { kind: 'none' }]]))
    expect(plan.update).toHaveLength(3)
    expect(plan.update[0]!.changes).toEqual({ courseId: undefined })
    expect((await alive()).every((e) => e.courseId === undefined)).toBe(true)
  })
  it('l\'indice di events non è cambiato', () => {
    expect(db.events.schema.indexes.map((i) => i.name).sort()).toEqual(['date', 'updatedAt'])
  })

  it('le lezioni nascoste escono dal contesto delle regole, le altre restano', async () => {
    await db.courses.bulkPut([course('fis', 'Fisica Moderna', { hideLessons: true }), course('calc', 'Calcolo Numerico')])
    const ev = (id: string, type: CalendarEvent['type'], courseId?: string): CalendarEvent => ({ id, date: '2026-10-28', start: '10:00', end: '11:00', title: id, type, suggested: false, confirmed: true, courseId, updatedAt: 1 })
    await db.events.bulkPut([ev('l1', 'lezione', 'fis'), ev('l2', 'lezione', 'calc'), ev('s1', 'studio', 'fis'), ev('l3', 'lezione')])
    const ctx = await loadRuleContext(db, '2026-10-28')
    expect(ctx.events.map((e) => e.id).sort()).toEqual(['l2', 'l3', 's1'])
    expect(ctx.eventsAll.map((e) => e.id).sort()).toEqual(['l2', 'l3', 's1'])
    await db.courses.put(course('fis', 'Fisica Moderna', { hideLessons: false }))
    expect((await loadRuleContext(db, '2026-10-28')).events).toHaveLength(4)
  })
})

describe('hide', () => {
  const lesson = (courseId?: string, type: CalendarEvent['type'] = 'lezione'): CalendarEvent => ({ id: `${courseId}${type}`, date: '2026-10-05', start: '10:00', end: '11:00', title: 't', type, suggested: false, confirmed: true, courseId, updatedAt: 1 })
  it('solo corsi vivi con hideLessons', () => {
    const cs = [course('a', 'A', { hideLessons: true }), course('b', 'B', { hideLessons: true, deletedAt: 5 }), course('c', 'C')]
    const hidden = hiddenCourseIds(cs)
    expect([...hidden]).toEqual(['a'])
    expect(isHiddenLesson(lesson('a'), hidden)).toBe(true)
    expect(isHiddenLesson(lesson('a', 'studio'), hidden)).toBe(false)
    expect(isHiddenLesson(lesson(), hidden)).toBe(false)
    expect(isHiddenLesson(lesson('b'), hidden)).toBe(false)
    expect(withoutHiddenLessons([lesson('a'), lesson('c'), lesson('a', 'studio')], cs)).toHaveLength(2)
  })
})

describe('preview e lettura', () => {
  const ctx = { yearStart: '09-01', today: '2026-10-29', displayZone: 'Europe/Rome', courses: COURSES, existing: [] as CalendarEvent[] }
  const code = (fn: () => unknown) => {
    try {
      fn()
    } catch (e) {
      return e instanceof AppError ? e.code : 'other'
    }
  }
  it('anteprima con gruppi e proposte', () => {
    const p = previewIcs(cal(fisica(), ['UID:r@fake.test', 'DTSTART:20261005T100000Z', 'RRULE:FREQ=MONTHLY']), ctx)
    expect(p.groups).toHaveLength(1)
    expect(p.groups[0]!.proposal?.courseId).toBe('fis')
    expect(p.parse.skipped.unsupportedRule).toBe(1)
  })
  it('errori specifici', () => {
    expect(code(() => previewIcs(cal(['UID:r@fake.test', 'DTSTART:20261005T100000Z', 'RRULE:FREQ=MONTHLY']), ctx))).toBe('icsNothingToImport')
    expect(code(() => previewIcs(cal(['UID:d@fake.test', 'DTSTART;VALUE=DATE:20261005']), ctx))).toBe('icsNothingToImport')
    expect(code(() => previewIcs(cal(fisica()), { ...ctx, today: '2024-01-10' }))).toBe('icsOutsideWindow')
    expect(code(() => previewIcs('boh', ctx))).toBe('icsNotCalendar')
  })
  it('lettura del file: limite e fallimenti', async () => {
    expect(await readIcsFile(new File(['BEGIN:VCALENDAR'], 'orario.ics'))).toBe('BEGIN:VCALENDAR')
    const big = { size: MAX_ICS_BYTES + 1, name: 'grande.ics', text: async () => '' } as unknown as File
    await expect(readIcsFile(big)).rejects.toMatchObject({ code: 'icsTooLarge', params: { mb: 5 } })
    const broken = { size: 10, name: 'rotto.ics', text: () => Promise.reject(new Error('x')) } as unknown as File
    await expect(readIcsFile(broken)).rejects.toMatchObject({ code: 'icsReadFailed', params: { name: 'rotto.ics' } })
  })
})
