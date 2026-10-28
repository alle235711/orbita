import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import { exportAll, importBackup, parseBackup, BackupError } from './backup'
import { exportCards, importCards, parseContentFile, ImportError } from './cards-io'
import { createDb, type OrbitaDB } from './db'
import { ensureCards, initDb } from './init'
import { patch, remove, save } from './repo'
import type { Session } from './schema'
import { ensureSeed, SEED_COURSES } from './seed'
import { getSetting, setSetting } from './settings'

let db: OrbitaDB
const loader = async () => structuredClone(content)

beforeEach(() => {
  db = createDb(`test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('seed', () => {
  it('crea corsi, scadenze, regole e impostazioni della SPEC §6', async () => {
    await ensureSeed(db)
    expect(await db.courses.count()).toBe(8)
    expect((await db.courses.get('sdm'))?.examDate).toBe('2026-11-13')
    expect((await db.courses.get('calcolo'))?.examDate).toBe('2026-11-17')
    expect((await db.courses.get('topalg'))?.examDate).toBe('2027-02')
    const tirocinio = await db.deadlines.get('tirocinio')
    expect(tirocinio).toMatchObject({ kind: 'periodo' })
    expect(tirocinio?.date).toBeUndefined() // le date si inseriscono in Dati
    expect(tirocinio?.endDate).toBeUndefined()
    expect((await db.deadlines.get('laurea'))?.date).toBe('2027-07')
    expect(await db.rules.count()).toBe(9)
    expect(await getSetting(db, 'newCardsPerDay')).toBe(15)
  })

  it('è idempotente e non tocca i record modificati', async () => {
    await ensureSeed(db)
    await patch(db.courses, 'sdm', { examDate: '2026-11-20' })
    await db.settings.delete('seedVersion')
    await ensureSeed(db)
    expect(await db.courses.count()).toBe(SEED_COURSES.length)
    expect((await db.courses.get('sdm'))?.examDate).toBe('2026-11-20')
  })
})

describe('schede', () => {
  it('importa al primo avvio le 502 schede (189, 152, 161)', async () => {
    await initDb(db, loader)
    expect(await db.cards.count()).toBe(502)
    expect(await db.cards.where('courseId').equals('sdm').count()).toBe(189)
    expect(await db.cards.where('courseId').equals('topalg').count()).toBe(152)
    expect(await db.cards.where('courseId').equals('astrost').count()).toBe(161)
    expect((await db.courses.get('sdm'))?.sections).toHaveLength(7)
    expect(await ensureCards(db, loader)).toBe(false)
  })

  it('non sovrascrive le schede modificate nell’app, salvo richiesta', async () => {
    await initDb(db, loader)
    await patch(db.cards, 'sdm-001', { text: 'Versione allineata alle slide.', userEdited: true })
    const file = parseContentFile(await loader())

    const kept = await importCards(db, file)
    expect(kept).toMatchObject({ added: 0, updated: 0, keptEdited: 1, unchanged: 501 })
    expect((await db.cards.get('sdm-001'))?.text).toBe('Versione allineata alle slide.')

    const forced = await importCards(db, file, { overwriteEdited: true })
    expect(forced.updated).toBe(1)
    expect((await db.cards.get('sdm-001'))?.text).toBe(content.schede[0]!.testo)
  })

  it('aggiorna le schede cambiate nel file e aggiunge le nuove', async () => {
    await initDb(db, loader)
    const file = parseContentFile(await loader())
    file.schede[1]!.testo = 'Testo rivisto.'
    file.schede.push({ ...file.schede[0]!, id: 'sdm-999', titolo: 'Nuova' })
    const result = await importCards(db, file)
    expect(result).toMatchObject({ added: 1, updated: 1 })
    expect((await db.cards.get('sdm-002'))?.updatedAt).toBeGreaterThan(0)
  })

  it('esporta nello stesso formato del file di partenza', async () => {
    await initDb(db, loader)
    const out = await exportCards(db)
    expect(out.schede).toEqual(content.schede)
    expect(out.corsi.map((c) => c.id)).toEqual(['sdm', 'topalg', 'astrost'])
    expect(parseContentFile(JSON.parse(JSON.stringify(out))).schede).toHaveLength(502)
  })

  it('segnala i file non validi', () => {
    expect(() => parseContentFile({ foo: 1 })).toThrow(ImportError)
    expect(() => parseContentFile({ schede: [{ id: 'x', corso: 'sdm' }] })).toThrow(/campo "sezione"/)
    const dup = structuredClone(content)
    dup.schede.push(dup.schede[0]!)
    expect(() => parseContentFile(dup)).toThrow(/due volte/)
  })
})

describe('backup', () => {
  it('esporta e reimporta tutti i dati senza perdite', async () => {
    await initDb(db, loader)
    await save<Session>(db.sessions, { date: '2026-10-27', minutes: 90, type: 'studio', courseId: 'sdm' })
    await save(db.days, { id: '2026-10-27', date: '2026-10-27', energy: 3 })
    await setSetting(db, 'newCardsPerDay', 20)
    const backup = JSON.parse(JSON.stringify(await exportAll(db)))

    const other = createDb(`test-${crypto.randomUUID()}`)
    const result = await importBackup(other, parseBackup(backup))
    expect(result.skipped).toBe(0)
    for (const name of Object.keys(backup.tables)) {
      const table = other.table(name)
      const sortById = (rows: unknown[]) => [...(rows as { id: string }[])].sort((a, b) => a.id.localeCompare(b.id))
      expect(sortById(await table.toArray())).toEqual(sortById(backup.tables[name]))
    }
    await other.delete()
  })

  it('fonde per id: vince l’updatedAt più recente', async () => {
    await save<Session>(db.sessions, { id: 's1', date: '2026-10-27', minutes: 60, type: 'studio' })
    const local = (await db.sessions.get('s1'))!
    const backup = parseBackup({
      app: 'orbita',
      format: 1,
      exportedAt: '',
      tables: {
        sessions: [
          { ...local, minutes: 30, updatedAt: local.updatedAt - 1000 },
          { id: 's2', date: '2026-10-26', minutes: 45, type: 'lavoro', updatedAt: 5 },
        ],
      },
    })
    expect(await importBackup(db, backup)).toEqual({ added: 1, updated: 0, skipped: 1 })
    expect((await db.sessions.get('s1'))?.minutes).toBe(60)

    const newer = parseBackup({ ...backup, tables: { sessions: [{ ...local, minutes: 75, updatedAt: local.updatedAt + 1000 }] } })
    expect(await importBackup(db, newer)).toEqual({ added: 0, updated: 1, skipped: 0 })
    expect((await db.sessions.get('s1'))?.minutes).toBe(75)
  })

  it('un seed nuovo non vince sulle modifiche contenute nel backup', async () => {
    await ensureSeed(db)
    await patch(db.courses, 'sdm', { examDate: '2026-11-27' })
    const backup = JSON.parse(JSON.stringify(await exportAll(db)))

    const fresh = createDb(`test-${crypto.randomUUID()}`)
    await ensureSeed(fresh)
    await importBackup(fresh, parseBackup(backup))
    expect((await fresh.courses.get('sdm'))?.examDate).toBe('2026-11-27')
    await fresh.delete()
  })

  it('rifiuta file che non sono backup', () => {
    expect(() => parseBackup({ app: 'altro', tables: {} })).toThrow(BackupError)
    expect(() => parseBackup({ app: 'orbita', format: 99, tables: {} })).toThrow(/più recente/)
    expect(() => parseBackup({ app: 'orbita', format: 1, tables: { sessions: [{ id: 1 }] } })).toThrow(/id o updatedAt/)
  })
})

describe('repo', () => {
  it('timbra updatedAt e cancella in modo logico', async () => {
    const row = await save<Session>(db.sessions, { date: '2026-10-27', minutes: 25, type: 'lean' })
    expect(row.id).toMatch(/[0-9a-f-]{36}/)
    expect(row.updatedAt).toBeGreaterThan(0)
    await remove(db.sessions, row.id)
    const deleted = await db.sessions.get(row.id)
    expect(deleted?.deletedAt).toBeGreaterThan(0)
    expect(deleted?.updatedAt).toBe(deleted?.deletedAt)
  })
})
