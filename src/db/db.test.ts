import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import { renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { exportAll, importBackup, parseBackup, BackupError } from './backup'
import { exportCards, importCards, parseContentFile, ImportError } from './cards-io'
import { createDb, SCHEMA_V1, SCHEMA_V3_DELTA, SCHEMA_V4_DELTA, type OrbitaDB } from './db'
import { migrateToV2, V2_INPUT_TABLES, type RawTables } from './migrations/v2'
import { v1Fixture } from '../test/fixtures'
import { ensureCards, initDb } from './init'
import { patch, remove, save } from './repo'
import type { Course, Session } from './schema'
import { ensureSeed } from './seed'
import { getSetting, setSetting } from './settings'

/** Il messaggio italiano di un errore lanciato da `fn`. */
const message = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    return renderError(e, i18nFor('it'))
  }
  return ''
}

/** Gli id dei mazzi d'esempio si leggono dal file, mai dal codice. */
const [DECK_A, DECK_B, DECK_C] = content.corsi.map((c) => c.id) as [string, string, string]

let db: OrbitaDB
const loader = async () => structuredClone(content)

beforeEach(() => {
  db = createDb(`test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  await db.delete()
})

describe('seed v2', () => {
  it('scrive solo la versione: nessun corso, scadenza, regola o impostazione', async () => {
    await initDb(db)
    expect(await db.courses.count()).toBe(0)
    expect(await db.deadlines.count()).toBe(0)
    expect(await db.rules.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)
    expect(await db.settings.toArray()).toEqual([{ id: 'seedVersion', value: 2, updatedAt: 0 }])
    expect(await getSetting(db, 'newCardsPerDay')).toBe(15)
    expect(await getSetting(db, 'profile')).toBeNull()
  })

  it('è idempotente e non abbassa una versione più alta', async () => {
    await ensureSeed(db)
    await ensureSeed(db)
    expect(await db.settings.count()).toBe(1)
    await db.settings.put({ id: 'seedVersion', value: 5, updatedAt: 0 })
    await ensureSeed(db)
    expect((await db.settings.get('seedVersion'))?.value).toBe(5)
  })
})

describe('schede', () => {
  it('importa le 502 schede d’esempio con ensureCards (189, 152, 161)', async () => {
    await ensureCards(db, loader)
    expect(await db.cards.count()).toBe(502)
    expect(await db.cards.where('courseId').equals(DECK_A).count()).toBe(189)
    expect(await db.cards.where('courseId').equals(DECK_B).count()).toBe(152)
    expect(await db.cards.where('courseId').equals(DECK_C).count()).toBe(161)
    expect((await db.courses.get(DECK_A))?.sections).toHaveLength(7)
    expect(await ensureCards(db, loader)).toBe(false)
  })

  it('non sovrascrive le schede modificate nell’app, salvo richiesta', async () => {
    await ensureCards(db, loader)
    await patch(db.cards, `${DECK_A}-001`, { text: 'Versione allineata alle slide.', userEdited: true })
    const file = parseContentFile(await loader())

    const kept = await importCards(db, file)
    expect(kept).toMatchObject({ added: 0, updated: 0, keptEdited: 1, unchanged: 501 })
    expect((await db.cards.get(`${DECK_A}-001`))?.text).toBe('Versione allineata alle slide.')

    const forced = await importCards(db, file, { overwriteEdited: true })
    expect(forced.updated).toBe(1)
    expect((await db.cards.get(`${DECK_A}-001`))?.text).toBe(content.schede[0]!.testo)
  })

  it('aggiorna le schede cambiate nel file e aggiunge le nuove', async () => {
    await ensureCards(db, loader)
    const file = parseContentFile(await loader())
    file.schede[1]!.testo = 'Testo rivisto.'
    file.schede.push({ ...file.schede[0]!, id: `${DECK_A}-999`, titolo: 'Nuova' })
    const result = await importCards(db, file)
    expect(result).toMatchObject({ added: 1, updated: 1 })
    expect((await db.cards.get(`${DECK_A}-002`))?.updatedAt).toBeGreaterThan(0)
  })

  it('esporta nello stesso formato del file di partenza', async () => {
    await ensureCards(db, loader)
    const out = await exportCards(db)
    const byId = (rows: { id: string }[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))
    expect(byId(out.schede)).toEqual(byId(content.schede))
    // corsi in ordine alfabetico per nome
    expect(out.corsi.map((c) => c.nome)).toEqual([...out.corsi.map((c) => c.nome)].sort((a, b) => a.localeCompare(b, 'it')))
    expect(out.corsi.map((c) => c.id).sort()).toEqual([DECK_A, DECK_B, DECK_C].sort())
    expect(parseContentFile(JSON.parse(JSON.stringify(out))).schede).toHaveLength(502)
  })

  it('importa ed esporta la lettura delle formule (letturaFormula)', async () => {
    const file = parseContentFile({
      versione: 2,
      aggiornato: '2026-11-02',
      corsi: [{ id: 'k', nome: 'Corso', sezioni: ['S'] }],
      schede: [
        { id: 'f1', corso: 'k', sezione: 'S', tipo: 'formula', titolo: 'Livelli', testo: 'Vale $$E_n = -13{,}6/n^2$$', chiave: '', letturaFormula: ' E con n uguale a meno 13,6 su n al quadrato ' },
        { id: 'f2', corso: 'k', sezione: 'S', tipo: 'formula', titolo: 'Altro', testo: 'Niente', chiave: '' },
      ],
    })
    await importCards(db, file)
    expect((await db.cards.get('f1'))?.formulaReading).toBe('E con n uguale a meno 13,6 su n al quadrato')
    expect(await db.cards.get('f2')).not.toHaveProperty('formulaReading')
    const out = await exportCards(db)
    expect(out.schede.find((s) => s.id === 'f1')?.letturaFormula).toBe('E con n uguale a meno 13,6 su n al quadrato')
    expect(out.schede.find((s) => s.id === 'f2')).not.toHaveProperty('letturaFormula')
    // un nuovo file con la lettura cambiata aggiorna la scheda, uno uguale no
    const again = await importCards(db, parseContentFile({ ...structuredClone(out), schede: out.schede.map((s) => (s.id === 'f1' ? { ...s, letturaFormula: 'nuova' } : s)) }))
    expect(again).toMatchObject({ updated: 1, unchanged: 1 })
    expect((await db.cards.get('f1'))?.formulaReading).toBe('nuova')
    // e il backup la porta con sé
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll(db))))
    expect(backup.tables.cards?.find((c) => c.id === 'f1')).toMatchObject({ formulaReading: 'nuova' })
  })

  it('segnala i file non validi', () => {
    expect(() => parseContentFile({ foo: 1 })).toThrow(ImportError)
    expect(message(() => parseContentFile({ schede: [{ id: 'x', corso: DECK_A }] }))).toMatch(/campo "sezione"/)
    const dup = structuredClone(content)
    dup.schede.push(dup.schede[0]!)
    expect(message(() => parseContentFile(dup))).toMatch(/due volte/)
  })
})

describe('backup', () => {
  it('esporta e reimporta tutti i dati senza perdite', async () => {
    await ensureCards(db, loader)
    await save<Session>(db.sessions, { date: '2026-10-27', minutes: 90, type: 'studio', courseId: DECK_A })
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
      format: 2,
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
    await save<Course>(db.courses, { id: 'c1', name: 'Corso finto', sections: [], difficulty: 2, examDate: '2026-11-20' })
    await patch(db.courses, 'c1', { examDate: '2026-11-27' })
    const backup = JSON.parse(JSON.stringify(await exportAll(db)))

    const fresh = createDb(`test-${crypto.randomUUID()}`)
    await ensureSeed(fresh)
    await importBackup(fresh, parseBackup(backup))
    expect((await fresh.courses.get('c1'))?.examDate).toBe('2026-11-27')
    await fresh.delete()
  })

  it('rifiuta file che non sono backup', () => {
    expect(() => parseBackup({ app: 'altro', tables: {} })).toThrow(BackupError)
    expect(message(() => parseBackup({ app: 'orbita', format: 99, tables: {} }))).toMatch(/più recente/)
    expect(message(() => parseBackup({ app: 'orbita', format: 1, tables: { sessions: [{ id: 1 }] } }))).toMatch(/id o updatedAt/)
  })
})

describe('repo', () => {
  it('timbra updatedAt e cancella in modo logico', async () => {
    const row = await save<Session>(db.sessions, { date: '2026-10-27', minutes: 25, type: 'abilita' })
    expect(row.id).toMatch(/[0-9a-f-]{36}/)
    expect(row.updatedAt).toBeGreaterThan(0)
    await remove(db.sessions, row.id)
    const deleted = await db.sessions.get(row.id)
    expect(deleted?.deletedAt).toBeGreaterThan(0)
    expect(deleted?.updatedAt).toBe(deleted?.deletedAt)
  })
})

describe('aggiornamento di Dexie dalla versione 1 alla 2', () => {
  const sorted = (rows: { id: string }[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id))

  async function openV1AndFill(name: string, fixture: RawTables): Promise<void> {
    const old = new Dexie(name)
    old.version(1).stores(SCHEMA_V1)
    for (const t of V2_INPUT_TABLES) await old.table(t).bulkPut(fixture[t] ?? [])
    old.close()
  }

  it('applica migrateToV2 in una transazione e lascia identiche le altre tabelle', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const fixture = v1Fixture()
    await openV1AndFill(name, fixture)
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(6)
      expect(await upgraded.results.count()).toBe(0)
      expect(await upgraded.appelli.count()).toBe(0)
      const expected = migrateToV2(fixture)
      for (const t of V2_INPUT_TABLES) expect(sorted(await upgraded.table(t).toArray()), t).toEqual(sorted(expected[t]!))
      expect(await upgraded.table('rules').get('lean')).toBeUndefined()
      expect((await upgraded.deadlines.get('laurea'))).toBeUndefined()
      expect((await upgraded.sessions.get('s1'))?.type).toBe('abilita')
      expect(await getSetting(upgraded, 'profile')).toMatchObject({ graduationTarget: '2027-07' })
      expect((await upgraded.settings.get('profile'))?.updatedAt).toBe(900)
    } finally {
      await upgraded.delete()
    }
  })

  it('un backup v1 importato in un database vuoto dà le stesse righe dell’aggiornamento', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const fixture = v1Fixture()
    await openV1AndFill(name, fixture)
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      await importBackup(db, parseBackup({ app: 'orbita', format: 1, exportedAt: '', tables: structuredClone(fixture) }))
      for (const t of V2_INPUT_TABLES) expect(sorted(await db.table(t).toArray()), t).toEqual(sorted(await upgraded.table(t).toArray()))
    } finally {
      await upgraded.delete()
    }
  })

  it('da v2 a v3 aggiunge solo la tabella dei risultati e lascia intatti i dati', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores(SCHEMA_V1)
    old.version(2).stores(SCHEMA_V1)
    await old.table('settings').bulkPut([{ id: 'newCardsPerDay', value: 7, updatedAt: 5 }])
    old.close()
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(6)
      expect(await getSetting(upgraded, 'newCardsPerDay')).toBe(7)
      expect(upgraded.results.schema.idxByName.courseId).toBeDefined()
      expect(upgraded.results.schema.idxByName.date).toBeDefined()
      expect(upgraded.results.schema.idxByName.updatedAt).toBeDefined()
    } finally {
      await upgraded.delete()
    }
  })

  it('da v3 a v4 aggiunge appelli e universi e lascia intatti i dati', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores(SCHEMA_V1)
    old.version(2).stores(SCHEMA_V1)
    old.version(3).stores(SCHEMA_V3_DELTA)
    await old.table('settings').bulkPut([{ id: 'newCardsPerDay', value: 9, updatedAt: 5 }])
    await old.table('results').bulkPut([{ id: 'r1', courseId: 'c', date: '2026-06-01', outcome: 'superato', grade: 27, updatedAt: 1 }])
    old.close()
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(6)
      expect(await getSetting(upgraded, 'newCardsPerDay')).toBe(9)
      expect((await upgraded.results.get('r1'))?.grade).toBe(27)
      expect(upgraded.appelli.schema.idxByName.courseId).toBeDefined()
      expect(upgraded.appelli.schema.idxByName.date).toBeDefined()
      expect(upgraded.universes.schema.idxByName.order).toBeDefined()
      expect(await upgraded.appelli.count()).toBe(0)
      expect(await upgraded.universes.count()).toBe(0)
    } finally {
      await upgraded.delete()
    }
  })

  it('da v4 a v5 normalizza la lettura delle formule delle schede e lascia intatto il resto', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const old = new Dexie(name)
    old.version(1).stores(SCHEMA_V1)
    old.version(2).stores(SCHEMA_V1)
    old.version(3).stores(SCHEMA_V3_DELTA)
    old.version(4).stores(SCHEMA_V4_DELTA)
    const base = { courseId: 'k', section: 'S', kind: 'definizione', title: 'T', text: 'Vale $E_n$.', key: 'E_n', needsFix: false, userEdited: false }
    await old.table('cards').bulkPut([
      { id: 'a', ...base, updatedAt: 1 },
      { id: 'b', ...base, letturaFormula: ' E con n ', updatedAt: 2 },
      { id: 'c', ...base, formulaReading: '  ', updatedAt: 3 },
    ])
    await old.table('settings').bulkPut([{ id: 'newCardsPerDay', value: 9, updatedAt: 5 }])
    old.close()
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(6)
      expect(await upgraded.cards.get('a')).toEqual({ id: 'a', ...base, updatedAt: 1 })
      expect(await upgraded.cards.get('b')).toEqual({ id: 'b', ...base, formulaReading: 'E con n', updatedAt: 2 })
      expect(await upgraded.cards.get('c')).toEqual({ id: 'c', ...base, updatedAt: 3 })
      expect(await getSetting(upgraded, 'newCardsPerDay')).toBe(9)
    } finally {
      await upgraded.delete()
    }
  })

  it('un database nuovo parte direttamente dalla versione 6, vuoto', async () => {
    await db.open()
    expect(db.verno).toBe(6)
    expect(await db.results.count()).toBe(0)
    expect(await db.appelli.count()).toBe(0)
    expect(await db.universes.count()).toBe(0)
    expect(await db.rules.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)
  })
})
