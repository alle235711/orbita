import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppError, renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { BackupError, exportAll, importBackup, parseBackup } from './backup'
import { createDb, type OrbitaDB } from './db'
import { loadRuleContext } from './plan-context'
import { normalizePendingCaptures, recordResult, removeResult } from './result-actions'
import { save } from './repo'
import type { Card, Course } from './schema'
import { getSetting, setSetting } from './settings'

let db: OrbitaDB

beforeEach(async () => {
  db = createDb(`test-${crypto.randomUUID()}`)
  await db.courses.bulkPut([
    { id: 'c1', name: 'Analisi Fittizia', sections: [], difficulty: 2, cfu: 9, examDate: '2026-11-20', updatedAt: 0 },
    { id: 'c2', name: 'Fisica Fittizia', sections: [], difficulty: 2, cfu: 6, examDate: '2026-12-01', updatedAt: 0 },
  ] satisfies Course[])
})

afterEach(async () => {
  await db.delete()
})

const pending = () => getSetting(db, 'pendingCaptures')
const draft = { courseId: 'c1', date: '2026-10-20', outcome: 'superato' as const, grade: 27 }

describe('recordResult', () => {
  it('a graded pass is captured once', async () => {
    const r = await recordResult(db, draft)
    expect(r.captured).toBe(true)
    expect(r.result).toMatchObject({ courseId: 'c1', grade: 27 })
    expect(await pending()).toEqual([{ resultId: r.result.id, courseId: 'c1' }])
    const edit = await recordResult(db, { ...draft, grade: 28 }, { id: r.result.id })
    expect(edit.captured).toBe(false)
    expect(await pending()).toHaveLength(1)
    expect((await db.results.get(r.result.id))?.grade).toBe(28)
  })

  it('idoneita and attempts never write captures', async () => {
    expect((await recordResult(db, { ...draft, grade: null })).captured).toBe(false)
    expect((await recordResult(db, { ...draft, courseId: 'c2', outcome: 'rifiutato' })).captured).toBe(false)
    expect(await pending()).toEqual([])
  })

  it('graded -> idoneita removes the pending entry; no stale grade or lode', async () => {
    const r = await recordResult(db, { ...draft, grade: 30, lode: true })
    expect((await db.results.get(r.result.id))?.lode).toBe(true)
    await recordResult(db, { ...draft, grade: null }, { id: r.result.id })
    expect(await pending()).toEqual([])
    const row = (await db.results.get(r.result.id))!
    expect('grade' in row).toBe(false)
    expect('lode' in row).toBe(false)
  })

  it('idoneita -> graded captures', async () => {
    const r = await recordResult(db, { ...draft, grade: null })
    const e = await recordResult(db, { ...draft, grade: 24 }, { id: r.result.id })
    expect(e.captured).toBe(true)
  })

  it('removeResult drops the pending entry and keeps the course', async () => {
    const r = await recordResult(db, draft)
    await removeResult(db, r.result.id)
    expect(await pending()).toEqual([])
    expect((await db.results.get(r.result.id))?.deletedAt).toBeGreaterThan(0)
    expect((await db.courses.get('c1'))?.deletedAt).toBeUndefined()
    await removeResult(db, 'nope')
  })

  it('throws AppError with the first invalid field', async () => {
    await expect(recordResult(db, { ...draft, courseId: 'zz', date: '' })).rejects.toMatchObject({ code: 'resultInvalid', params: { field: 'course', code: 'invalid' } })
    const e = await recordResult(db, { ...draft, grade: 31 }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(AppError)
    expect(renderError(e, i18nFor('it'))).toBe('Il voto va da 18 a 30.')
    expect(await db.results.count()).toBe(0)
  })

  it('normalizePendingCaptures', () => {
    expect(normalizePendingCaptures('x')).toEqual([])
    expect(normalizePendingCaptures([{ resultId: 'a', courseId: 'c' }, { resultId: 'a', courseId: 'd' }, { resultId: 1, courseId: 'c' }, null])).toEqual([{ resultId: 'a', courseId: 'c' }])
    expect(normalizePendingCaptures(Array.from({ length: 300 }, (_, i) => ({ resultId: `r${i}`, courseId: 'c' })))).toHaveLength(200)
  })
})

describe('backup with results', () => {
  it('round trips', async () => {
    const r = await recordResult(db, draft)
    const backup = JSON.parse(JSON.stringify(await exportAll(db)))
    expect(backup.tables.results).toHaveLength(1)
    const other = createDb(`test-${crypto.randomUUID()}`)
    await importBackup(other, parseBackup(backup))
    expect(await other.results.get(r.result.id)).toEqual(r.result)
    await other.delete()
  })

  it('a backup without results imports; invalid rows throw', () => {
    expect(() => parseBackup({ app: 'orbita', format: 2, exportedAt: '', tables: { days: [] } })).not.toThrow()
    const row = { id: 'r', updatedAt: 1, courseId: 'c1', date: '2026-10-20', outcome: 'superato', grade: 27 }
    const bad = (extra: object) => () => parseBackup({ app: 'orbita', format: 2, exportedAt: '', tables: { results: [{ ...row, ...extra }] } })
    expect(bad({})).not.toThrow()
    for (const extra of [{ grade: 31 }, { grade: 20.5 }, { date: '2026-10' }, { outcome: 'boh' }, { courseId: 4 }, { lode: 'si' }, { deletedAt: 5, grade: 3 }]) {
      expect(bad(extra)).toThrow(BackupError)
    }
    try {
      bad({ grade: 3 })()
    } catch (e) {
      expect(renderError(e, i18nFor('en'))).toBe('A grade in the backup is not valid.')
    }
  })
})

describe('plan context', () => {
  const card = (id: string, courseId: string): Card => ({ id, courseId, section: 's', kind: 'k', title: id, text: 't', key: id, needsFix: false, userEdited: false, updatedAt: 0 })

  it('a passed course leaves courses and the queue, and comes back when the pass is deleted', async () => {
    await db.cards.bulkPut([card('k1', 'c1'), card('k2', 'c2')])
    await setSetting(db, 'newCardsPerDay', 10)
    const before = await loadRuleContext(db, '2026-10-28')
    expect(before.courses.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    expect(before.cards.fresh['c1']).toBeGreaterThan(0)

    const r = await recordResult(db, draft)
    const after = await loadRuleContext(db, '2026-10-28')
    expect(after.courses.map((c) => c.id)).toEqual(['c2'])
    expect(after.cards.fresh['c1']).toBeUndefined()
    expect(after.cards.due['c1']).toBeUndefined()
    expect(after.results).toHaveLength(1)
    expect(await db.cards.count()).toBe(2)

    await removeResult(db, r.result.id)
    const back = await loadRuleContext(db, '2026-10-28')
    expect(back.courses.map((c) => c.id).sort()).toEqual(['c1', 'c2'])
    expect(back.cards.fresh['c1']).toBeGreaterThan(0)
  })

  it('an attempt keeps the course active', async () => {
    await save(db.results, { courseId: 'c1', date: '2026-10-20', outcome: 'rifiutato' })
    expect((await loadRuleContext(db, '2026-10-28')).courses).toHaveLength(2)
  })
})
