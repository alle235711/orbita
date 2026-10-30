import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError, renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { exportAll, importBackup, parseBackup, BackupError } from './backup'
import { createDb, type OrbitaDB } from './db'
import { addAppello, chooseUniverse, createUniverse, editAppello, ensureUniverses, removeAppello, removeUniverse, renameUniverse, setExpectedGrade, setPick } from './multiverse-actions'
import type { Course } from './schema'

const TODAY = '2026-11-02'
let db: OrbitaDB

beforeEach(async () => {
  db = createDb(`test-${crypto.randomUUID()}`)
  await db.courses.bulkPut([
    { id: 'c1', name: 'Analisi Fittizia', sections: [], difficulty: 2, cfu: 9, examDate: '2026-11-20', updatedAt: 0 },
    { id: 'c2', name: 'Fisica Fittizia', sections: [], difficulty: 2, cfu: 6, updatedAt: 0 },
  ] satisfies Course[])
})
afterEach(async () => {
  await db.delete()
})

const code = async (p: Promise<unknown>) => {
  try {
    await p
  } catch (e) {
    return e instanceof AppError ? [e.code, e.params] : e
  }
  return null
}

describe('appelli', () => {
  it('adds, trims the note and validates', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25', note: `  ${'x'.repeat(100)}  ` })
    expect(a.note).toHaveLength(80)
    expect((await addAppello(db, { courseId: 'c1', date: '2026-12', note: '  ' })).note).toBeUndefined()
    expect(await code(addAppello(db, { courseId: '', date: '2026-11-25' }))).toEqual(['appelloInvalid', { field: 'course', code: 'required' }])
    expect(await code(addAppello(db, { courseId: 'zz', date: '2026-11-25' }))).toEqual(['appelloInvalid', { field: 'course', code: 'invalid' }])
    expect(await code(addAppello(db, { courseId: 'c1', date: '' }))).toEqual(['appelloInvalid', { field: 'date', code: 'required' }])
    expect(await code(addAppello(db, { courseId: 'c1', date: '2026-02-30' }))).toEqual(['appelloInvalid', { field: 'date', code: 'invalid' }])
    expect(await code(addAppello(db, { courseId: 'c1', date: '2026-13' }))).toEqual(['appelloInvalid', { field: 'date', code: 'invalid' }])
    expect(await code(addAppello(db, { courseId: 'c1', date: '2026-11-25' }))).toEqual(['appelloInvalid', { field: 'date', code: 'duplicate' }])
    expect(await addAppello(db, { courseId: 'c2', date: '2026-11-25' })).toMatchObject({ courseId: 'c2' })
  })

  it('a past sitting is stored', async () => {
    expect((await addAppello(db, { courseId: 'c1', date: '2025-01-10' })).date).toBe('2025-01-10')
  })

  it('edits: duplicate excludes itself, a note can be cleared', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25', note: 'aula 3' })
    const b = await addAppello(db, { courseId: 'c1', date: '2026-12-10' })
    expect((await editAppello(db, a.id, { date: '2026-11-25', note: 'aula 4' })).note).toBe('aula 4')
    expect('note' in (await editAppello(db, a.id, { note: null }))).toBe(false)
    expect(await code(editAppello(db, b.id, { date: '2026-11-25' }))).toEqual(['appelloInvalid', { field: 'date', code: 'duplicate' }])
    expect((await db.appelli.get(b.id))?.date).toBe('2026-12-10')
  })

  it('removing an appello cleans the picks of every universe', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    const keep = await addAppello(db, { courseId: 'c2', date: '2026-11-26' })
    const u1 = await createUniverse(db, TODAY)
    const u2 = await createUniverse(db, TODAY)
    expect(u1.picks).toEqual({ c1: a.id, c2: keep.id })
    await removeAppello(db, a.id)
    expect((await db.appelli.get(a.id))?.deletedAt).toBeGreaterThan(0)
    for (const u of [u1, u2]) expect((await db.universes.get(u.id))?.picks).toEqual({ c2: keep.id })
    await removeAppello(db, 'sconosciuto')
  })
})

describe('universi', () => {
  it('creates up to four with suggested picks, the fifth throws', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    const b = await addAppello(db, { courseId: 'c1', date: '2026-12-15' })
    const list = []
    for (let i = 0; i < 4; i++) list.push(await createUniverse(db, TODAY))
    expect(list.map((u) => u.order)).toEqual([0, 1, 2, 3])
    expect(list.map((u) => u.picks.c1)).toEqual([a.id, b.id, b.id, b.id])
    expect(await code(createUniverse(db, TODAY))).toEqual(['universeLimit', {}])
  })

  it('cannot go below two; rename, pick and grade', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    const u1 = await createUniverse(db, TODAY)
    const u2 = await createUniverse(db, TODAY)
    expect(await code(removeUniverse(db, u1.id))).toEqual(['universeMin', {}])
    const u3 = await createUniverse(db, TODAY)
    await removeUniverse(db, u3.id)
    expect((await db.universes.get(u3.id))?.deletedAt).toBeGreaterThan(0)
    await removeUniverse(db, 'sconosciuto')
    expect((await createUniverse(db, TODAY)).order).toBe(2)

    await renameUniverse(db, u2.id, `  ${'n'.repeat(60)} `)
    expect((await db.universes.get(u2.id))?.name).toHaveLength(40)
    await setPick(db, u2.id, 'c1', null)
    expect((await db.universes.get(u2.id))?.picks).toEqual({})
    await setPick(db, u2.id, 'c1', a.id)
    expect((await db.universes.get(u2.id))?.picks).toEqual({ c1: a.id })
    expect(await code(setPick(db, u2.id, 'c2', a.id))).toEqual(['appelloInvalid', { field: 'course', code: 'invalid' }])
    await setExpectedGrade(db, u2.id, 'c1', 35)
    expect((await db.universes.get(u2.id))?.grades).toEqual({ c1: 30 })
    await setExpectedGrade(db, u2.id, 'c1', 24.26)
    expect((await db.universes.get(u2.id))?.grades).toEqual({ c1: 24.3 })
    await setExpectedGrade(db, u2.id, 'c1', null)
    expect((await db.universes.get(u2.id))?.grades).toEqual({})
  })

  it('ensureUniverses tops up to two only when there is an exam', async () => {
    expect(await ensureUniverses(db, TODAY)).toBe(0)
    await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    expect(await ensureUniverses(db, TODAY)).toBe(2)
    expect(await ensureUniverses(db, TODAY)).toBe(0)
  })
})

describe('chooseUniverse', () => {
  it('patches only courses.examDate, is idempotent and leaves everything else', async () => {
    const a = await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    const b = await addAppello(db, { courseId: 'c2', date: '2026-12' })
    await createUniverse(db, TODAY)
    const u = await createUniverse(db, TODAY)
    expect(u.picks).toEqual({ c1: a.id, c2: b.id })
    const before = { appelli: await db.appelli.toArray(), universes: await db.universes.toArray(), results: await db.results.toArray() }
    const changes = await chooseUniverse(db, u.id, TODAY)
    expect(changes).toEqual([
      { courseId: 'c1', name: 'Analisi Fittizia', from: '2026-11-20', to: '2026-11-25' },
      { courseId: 'c2', name: 'Fisica Fittizia', from: undefined, to: '2026-12' },
    ])
    expect((await db.courses.get('c1'))?.examDate).toBe('2026-11-25')
    expect((await db.courses.get('c2'))?.examDate).toBe('2026-12')
    expect(await db.appelli.toArray()).toEqual(before.appelli)
    expect(await db.universes.toArray()).toEqual(before.universes)
    expect(await db.results.toArray()).toEqual(before.results)
    expect(await chooseUniverse(db, u.id, TODAY)).toEqual([])
    expect(await chooseUniverse(db, 'sconosciuto', TODAY)).toEqual([])
  })
})

describe('backup with appelli and universes', () => {
  it('round trips both tables and tolerates a backup without them', async () => {
    await addAppello(db, { courseId: 'c1', date: '2026-11-25' })
    await createUniverse(db, TODAY)
    const backup = JSON.parse(JSON.stringify(await exportAll(db)))
    expect(backup.format).toBe(2)
    expect(backup.tables.appelli).toHaveLength(1)
    expect(backup.tables.universes).toHaveLength(1)
    const other = createDb(`test-${crypto.randomUUID()}`)
    try {
      await importBackup(other, parseBackup(backup))
      expect(await other.appelli.toArray()).toEqual(backup.tables.appelli)
      expect(await other.universes.toArray()).toEqual(backup.tables.universes)
      delete backup.tables.appelli
      delete backup.tables.universes
      expect(() => parseBackup(backup)).not.toThrow()
    } finally {
      await other.delete()
    }
  })

  it('rejects invalid rows, deleted ones included', () => {
    const bad = (tables: object) => {
      try {
        parseBackup({ app: 'orbita', format: 2, exportedAt: '', tables })
      } catch (e) {
        expect(e).toBeInstanceOf(BackupError)
        return renderError(e, i18nFor('en'))
      }
      return null
    }
    const ap = { id: 'a', courseId: 'c1', date: '2026-11-25', updatedAt: 1 }
    const un = { id: 'u', name: '', picks: { c1: 'a' }, grades: { c1: 27 }, order: 0, updatedAt: 1 }
    expect(bad({ appelli: [ap], universes: [un] })).toBeNull()
    expect(bad({ appelli: [{ ...ap, courseId: '' }] })).toBe('A sitting in the backup is not valid.')
    expect(bad({ appelli: [{ ...ap, date: '2026-13' }] })).toBe('A sitting in the backup is not valid.')
    expect(bad({ appelli: [{ ...ap, date: '2026-02-30', deletedAt: 5 }] })).toBe('A sitting in the backup is not valid.')
    expect(bad({ appelli: [{ ...ap, note: 4 }] })).toBe('A sitting in the backup is not valid.')
    expect(bad({ universes: [{ ...un, name: 3 }] })).toBe('A universe in the backup is not valid.')
    expect(bad({ universes: [{ ...un, picks: { c1: 4 } }] })).toBe('A universe in the backup is not valid.')
    expect(bad({ universes: [{ ...un, grades: { c1: Infinity } }] })).toBe('A universe in the backup is not valid.')
    expect(bad({ universes: [{ ...un, order: NaN }] })).toBe('A universe in the backup is not valid.')
  })
})
