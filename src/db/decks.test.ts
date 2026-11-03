import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { parseDeckFile } from '../decks/file'
import { deckToOrbita, deckToPayload, orbitaToDeck, payloadToDeck } from '../decks/pack'
import { renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { card, course, deck, manyCards } from '../test/deck-fixtures'
import { exportAll, importBackup, parseBackup } from './backup'
import { createDb, SCHEMA_V1, SCHEMA_V3_DELTA, SCHEMA_V4_DELTA, SCHEMA_V6_DELTA, type OrbitaDB } from './db'
import { deckEntries, defaultMeta, exportDeck, importDeck, listDeckEntries, previewDeckImport, saveDeck } from './decks'
import { patch, remove } from './repo'
import type { Card } from './schema'

let a: OrbitaDB
let b: OrbitaDB

beforeEach(() => {
  a = createDb(`deck-a-${crypto.randomUUID()}`)
  b = createDb(`deck-b-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await a.delete()
  await b.delete()
})

const message = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    return renderError(e, i18nFor('it'))
  }
  return ''
}

const meta = { name: 'Analisi 1, appunti', author: 'Ada Demo', university: 'Università di Prova', course: 'Analisi 1', year: '2026/2027', license: 'CC BY 4.0', notes: 'Fatto a mano.' }

/** Il dispositivo A: un corso con tre schede. */
async function seedA(cards: Card[] = [card('a'), card('b', { section: 'Serie' }), card('c', { formulaReading: 'lettura' })]) {
  await a.courses.put(course())
  await a.cards.bulkPut(cards)
  await saveDeck(a, 'c1', meta)
}

describe('elenco dei mazzi', () => {
  it('ogni corso con schede vive è un mazzo, anche senza record dei metadati', async () => {
    await a.courses.bulkPut([course(), course({ id: 'c2', name: 'Algebra' }), course({ id: 'c3', name: 'Senza schede' }), course({ id: 'c4', name: 'Cancellato', deletedAt: 5 })])
    await a.cards.bulkPut([card('a'), card('b', { section: 'Serie' }), card('x', { courseId: 'c2' }), card('y', { courseId: 'c4' }), card('z', { courseId: 'c3', deletedAt: 3 })])
    const list = await listDeckEntries(a)
    expect(list.map((e) => [e.course.name, e.cards, e.sections, e.deck])).toEqual([
      ['Algebra', 1, 1, undefined],
      ['Analisi 1', 2, 2, undefined],
    ])
  })

  it('il nome è quello del mazzo se c’è, e l’origine si legge dal record', async () => {
    await seedA()
    const [e] = await listDeckEntries(a)
    expect(e!.deck).toMatchObject({ name: 'Analisi 1, appunti' })
    expect(e!.deck!.origin).toBeUndefined()
    expect(deckEntries([course()], [], [card('a')])[0]!.deck).toBeUndefined()
  })

  it('metadati proposti: nome e corso dal corso locale, nient’altro (niente dati personali)', () => {
    expect(defaultMeta({ name: 'Analisi 1' })).toEqual({ name: 'Analisi 1', author: '', university: '', course: 'Analisi 1', year: '', license: '', notes: '' })
    expect(defaultMeta({ name: 'x' }, deck())).toMatchObject({ author: 'Ada Demo' })
  })
})

describe('saveDeck', () => {
  it('crea il record la prima volta e poi lo aggiorna; updatedAt cambia solo se cambia qualcosa', async () => {
    await a.courses.put(course())
    const first = await saveDeck(a, 'c1', { ...meta, name: '  Analisi 1, appunti ' })
    expect(first).toMatchObject({ ...meta, courseId: 'c1' })
    expect(first.origin).toBeUndefined()
    const again = await saveDeck(a, 'c1', meta)
    expect(again).toEqual(first)
    await new Promise((r) => setTimeout(r, 5))
    const changed = await saveDeck(a, 'c1', { ...meta, license: 'CC0' })
    expect(changed.id).toBe(first.id)
    expect(changed.license).toBe('CC0')
    expect(changed.updatedAt).toBeGreaterThan(first.updatedAt)
    expect(await a.decks.count()).toBe(1)
  })

  it('serve un nome e un corso che esista', async () => {
    await a.courses.put(course())
    expect(await message(saveDeck(a, 'c1', { ...meta, name: '  ' }))).toBe('Il mazzo ha bisogno di un nome.')
    expect(await message(saveDeck(a, 'nessuno', meta))).toBe('Il corso non esiste più.')
    expect(await a.decks.count()).toBe(0)
  })
})

describe('esporta → importa', () => {
  it('ciclo identico tra due dispositivi: stesse schede, stessi campi, e il mazzo arriva con la sua origine', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1', '2026-11-03')
    const result = await importDeck(b, parseDeckFile(JSON.parse(JSON.stringify(file))))
    expect(result).toMatchObject({ cards: { added: 3, updated: 0, unchanged: 0, skipped: 0 }, deck: 'new', courseId: 'deck:' + file.mazzo.id, deckId: file.mazzo.id })

    const sent = (await a.cards.toArray()).sort((x, y) => x.id.localeCompare(y.id))
    const got = (await b.cards.toArray()).sort((x, y) => x.id.localeCompare(y.id))
    expect(got).toEqual(sent.map((c) => ({ ...c, courseId: 'deck:' + file.mazzo.id })))

    expect(await b.courses.get('deck:' + file.mazzo.id)).toMatchObject({ name: 'Analisi 1', sections: ['Limiti', 'Serie'], difficulty: 2 })
    const received = await b.decks.get(file.mazzo.id)
    expect(received).toMatchObject({ ...meta, courseId: 'deck:' + file.mazzo.id, origin: { author: 'Ada Demo', university: 'Università di Prova' } })
    // Ri-esportare dal secondo dispositivo dà lo stesso mazzo (stessi id, stesse schede, stessi metadati).
    const back = await exportDeck(b, 'deck:' + file.mazzo.id, '2026-11-03')
    expect(back).toEqual(file)
    // Nessuno stato di ripasso è stato creato.
    expect(await b.cardState.count()).toBe(0)
  })

  it('ciclo identico anche attraverso la compressione: .orbita e payload del QR', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1', '2026-11-03')
    const viaFile = await orbitaToDeck(await deckToOrbita(file))
    const viaQr = await payloadToDeck(await deckToPayload(file))
    expect(viaFile).toEqual(file)
    expect(viaQr).toEqual(file)
    await importDeck(b, viaQr)
    expect((await b.cards.toArray()).map((c) => c.id).sort()).toEqual(['a', 'b', 'c'])
  })

  it('reimportare lo stesso file non duplica nulla: tutto uguale, nessuna scrittura', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await importDeck(b, file)
    const before = await b.cards.toArray()
    const second = await importDeck(b, file)
    expect(second).toMatchObject({ cards: { added: 0, updated: 0, unchanged: 3, skipped: 0 }, deck: 'unchanged' })
    expect(await b.cards.toArray()).toEqual(before)
    expect(await b.courses.count()).toBe(1)
    expect(await b.decks.count()).toBe(1)
    // E nel dispositivo di partenza: il file è suo.
    expect(await importDeck(a, file)).toMatchObject({ cards: { unchanged: 3 }, deck: 'unchanged' })
    expect(await a.courses.count()).toBe(1)
  })

  it('l’anteprima non scrive nulla e dà lo stesso resoconto dell’importazione', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    const preview = await previewDeckImport(b, file)
    expect(preview).toMatchObject({ courseId: 'deck:' + file.mazzo.id, courseName: 'Analisi 1', courseExists: false })
    expect(await b.cards.count()).toBe(0)
    expect(await b.courses.count()).toBe(0)
    expect(await b.decks.count()).toBe(0)
    const done = await importDeck(b, file)
    expect(done.cards).toEqual(preview.plan.cards)
    expect((await previewDeckImport(b, file)).courseExists).toBe(true)
  })

  it('un mazzo ricevuto che si aggiorna: la scheda più nuova vince, le informazioni nuove pure', async () => {
    await seedA()
    await importDeck(b, await exportDeck(a, 'c1'))
    await new Promise((r) => setTimeout(r, 5))
    await patch(a.cards, 'a', { text: 'Testo migliorato' })
    await saveDeck(a, 'c1', { ...meta, notes: 'Corretto.' })
    const r = await importDeck(b, await exportDeck(a, 'c1'))
    expect(r).toMatchObject({ cards: { updated: 1, unchanged: 2 }, deck: 'updated' })
    expect((await b.cards.get('a'))!.text).toBe('Testo migliorato')
    expect((await b.cards.get('a'))!.userEdited).toBe(false)
    expect((await b.decks.get((await a.decks.toArray())[0]!.id))!.notes).toBe('Corretto.')
    expect(await b.cards.count()).toBe(3)
  })

  it('le schede modificate dall’utente restano com’è, quelle cancellate qui restano cancellate', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await importDeck(b, file)
    const target = 'deck:' + file.mazzo.id
    // A cambia 'b'; poi B cambia 'a' (modificata dall’utente) e cancella 'b'; poi A cambia 'a'.
    await new Promise((r) => setTimeout(r, 5))
    await patch(a.cards, 'b', { text: 'Versione di A, bis' })
    await new Promise((r) => setTimeout(r, 5))
    await patch(b.cards, 'a', { text: 'Versione di B', userEdited: true })
    await remove(b.cards, 'b')
    await new Promise((r) => setTimeout(r, 5))
    await patch(a.cards, 'a', { text: 'Versione di A' })
    const r = await importDeck(b, await exportDeck(a, 'c1'))
    expect(r.cards).toMatchObject({ skipped: 2, keptEdited: 1, updated: 0, unchanged: 1 })
    expect((await b.cards.get('a'))!.text).toBe('Versione di B')
    expect((await b.cards.get('b'))!.deletedAt).toBeGreaterThan(0)
    // Un elenco della pagina non mostra la scheda cancellata.
    expect((await listDeckEntries(b)).find((e) => e.course.id === target)!.cards).toBe(2)
  })

  it('una scheda cancellata qui torna solo se la versione del file è più recente della cancellazione', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await importDeck(b, file)
    await new Promise((r) => setTimeout(r, 5))
    await remove(b.cards, 'b')
    await new Promise((r) => setTimeout(r, 5))
    await patch(a.cards, 'b', { text: 'Corretta dopo la cancellazione' })
    const r = await importDeck(b, await exportDeck(a, 'c1'))
    expect(r.cards).toMatchObject({ updated: 1, unchanged: 2, skipped: 0 })
    expect(await b.cards.get('b')).toMatchObject({ text: 'Corretta dopo la cancellazione' })
    expect((await b.cards.get('b'))!.deletedAt).toBeUndefined()
  })

  it('una cancellazione dentro il file (mazzo scritto da altri) cancella in modo logico la scheda vecchia', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await importDeck(b, file)
    const withTombstone = { ...file, schede: file.schede.map((s) => (s.id === 'c' ? { ...s, aggiornata: 9_000_000_000_000, cancellata: 9_000_000_000_000 } : s)) }
    const r = await importDeck(b, withTombstone)
    expect(r.cards).toMatchObject({ updated: 1, unchanged: 2 })
    expect(await b.cards.get('c')).toMatchObject({ deletedAt: 9_000_000_000_000, updatedAt: 9_000_000_000_000 })
  })

  it('un id che esiste già in un altro corso non si sposta', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await b.courses.put(course({ id: 'mio', name: 'Mio corso' }))
    await b.cards.put(card('a', { courseId: 'mio', text: 'Mia scheda' }))
    const r = await importDeck(b, file)
    expect(r.cards).toMatchObject({ added: 2, skipped: 1, elsewhere: 1 })
    expect(await b.cards.get('a')).toMatchObject({ courseId: 'mio', text: 'Mia scheda' })
  })

  it('un corso locale cancellato che ospitava il mazzo torna, e le sezioni nuove entrano una volta sola', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await importDeck(b, file)
    const id = 'deck:' + file.mazzo.id
    await remove(b.courses, id)
    await b.courses.update(id, { sections: ['Limiti'] })
    await importDeck(b, file)
    const c = (await b.courses.get(id))!
    expect(c.deletedAt).toBeUndefined()
    expect(c.sections).toEqual(['Limiti', 'Serie'])
    await importDeck(b, file)
    expect((await b.courses.get(id))!.sections).toEqual(['Limiti', 'Serie'])
  })

  it('l’esportazione lascia fuori le schede cancellate e rifiuta un corso senza schede', async () => {
    await seedA()
    await remove(a.cards, 'b')
    expect((await exportDeck(a, 'c1')).schede.map((s) => s.id)).toEqual(['a', 'c'])
    await remove(a.cards, 'a')
    await remove(a.cards, 'c')
    expect(await message(exportDeck(a, 'c1'))).toBe('Questo corso non ha schede da condividere.')
    await a.courses.put(course({ id: 'senza', name: 'Senza' }))
    expect(await message(exportDeck(a, 'senza'))).toBe('Il mazzo ha bisogno di un nome.')
    expect(await message(exportDeck(a, 'nessuno'))).toBe('Il corso non esiste più.')
  })

  it('un mazzo grande passa il ciclo compresso e si importa intero', async () => {
    await a.courses.put(course())
    await a.cards.bulkPut(manyCards(150))
    await saveDeck(a, 'c1', meta)
    const file = await exportDeck(a, 'c1')
    const r = await importDeck(b, await payloadToDeck(await deckToPayload(file)))
    expect(r.cards.added).toBe(150)
    expect(await b.cards.count()).toBe(150)
  })
})

describe('file malformato: nessun dato perso', () => {
  it('una scheda rotta in fondo al file non lascia scritta nessuna delle precedenti', async () => {
    await seedA()
    const file = JSON.parse(JSON.stringify(await exportDeck(a, 'c1')))
    file.schede[2].testo = 42
    expect(await message(Promise.resolve().then(() => parseDeckFile(file)))).toBe('La scheda c del mazzo non ha il campo «testo» o non è valido.')
    expect(await b.cards.count()).toBe(0)
    expect(await b.courses.count()).toBe(0)
    expect(await b.decks.count()).toBe(0)
  })

  it('un errore nel mezzo della scrittura annulla tutta la transazione', async () => {
    await seedA()
    const file = await exportDeck(a, 'c1')
    await b.decks.put(deck({ id: file.mazzo.id, courseId: 'deck:' + file.mazzo.id, updatedAt: 1 }))
    // Una scheda con un id non valido come chiave fa fallire la scrittura nel database, dopo che il corso è stato scritto: tutto torna com'era.
    const broken = { ...file, schede: file.schede.map((s, i) => (i === 2 ? ({ ...s, id: { x: 1 } } as never) : s)) }
    await expect(importDeck(b, broken)).rejects.toThrow()
    expect(await b.cards.count()).toBe(0)
    expect(await b.courses.count()).toBe(0)
    expect((await b.decks.get(file.mazzo.id))!.updatedAt).toBe(1)
  })
})

describe('backup', () => {
  it('i mazzi entrano nel backup e tornano con la fusione per updatedAt', async () => {
    await seedA()
    const backup = parseBackup(JSON.parse(JSON.stringify(await exportAll(a))))
    expect(backup.tables.decks).toHaveLength(1)
    const r = await importBackup(b, backup)
    expect(r.added).toBeGreaterThan(0)
    expect(await b.decks.toArray()).toEqual(await a.decks.toArray())
    expect(await importBackup(b, backup)).toMatchObject({ added: 0, updated: 0 })
  })

  it('un backup senza mazzi (di prima) si legge come sempre; un mazzo storto lo rifiuta', async () => {
    const old = parseBackup({ app: 'orbita', format: 2, exportedAt: 'x', tables: { settings: [{ id: 's', value: 1, updatedAt: 1 }] } })
    expect(old.tables.decks).toBeUndefined()
    const bad = { app: 'orbita', format: 2, exportedAt: 'x', tables: { decks: [{ id: 'd', courseId: 'c', name: 5, updatedAt: 1 }] } }
    expect(() => parseBackup(bad)).toThrow()
    try {
      parseBackup(bad)
    } catch (e) {
      expect(renderError(e, i18nFor('it'))).toBe('Un mazzo del backup non è valido.')
    }
    const badOrigin = { app: 'orbita', format: 2, exportedAt: 'x', tables: { decks: [{ ...deck(), origin: 'x' }] } }
    expect(() => parseBackup(badOrigin)).toThrow()
  })
})

describe('aggiornamento di Dexie dalla versione 5 alla 6', () => {
  const oldDb = (name: string) => {
    const old = new Dexie(name)
    old.version(1).stores(SCHEMA_V1)
    old.version(2).stores(SCHEMA_V1)
    old.version(3).stores(SCHEMA_V3_DELTA)
    old.version(4).stores(SCHEMA_V4_DELTA)
    old.version(5).stores({})
    return old
  }

  it('aggiunge la tabella dei mazzi (con i suoi indici) e lascia intatti tutti gli altri dati', async () => {
    const name = `upgrade-${crypto.randomUUID()}`
    const old = oldDb(name)
    const cards = [card('a', { updatedAt: 3 }), card('b', { formulaReading: 'lettura', userEdited: true, updatedAt: 4 })]
    await old.table('courses').put(course({ sampleDeck: 'sdm' }))
    await old.table('cards').bulkPut(cards)
    await old.table('cardState').put({ id: 'a', box: 3, due: '2026-12-01', firstReviewed: '2026-11-01', lastReviewed: '2026-11-02', updatedAt: 6 })
    await old.table('settings').put({ id: 'newCardsPerDay', value: 9, updatedAt: 5 })
    old.close()
    const upgraded = createDb(name)
    try {
      await upgraded.open()
      expect(upgraded.verno).toBe(6)
      expect(await upgraded.decks.count()).toBe(0)
      expect(upgraded.decks.schema.idxByName.courseId).toBeDefined()
      expect(upgraded.decks.schema.idxByName.updatedAt).toBeDefined()
      expect(await upgraded.cards.toArray()).toEqual(cards)
      expect(await upgraded.courses.get('c1')).toEqual(course({ sampleDeck: 'sdm' }))
      expect(await upgraded.cardState.get('a')).toMatchObject({ box: 3, due: '2026-12-01' })
      expect((await upgraded.settings.get('newCardsPerDay'))?.value).toBe(9)
      expect(SCHEMA_V6_DELTA).toEqual({ decks: 'id, courseId, updatedAt' })
    } finally {
      await upgraded.delete()
    }
  })

  it('un database nuovo parte direttamente dalla versione 6, con i mazzi vuoti', async () => {
    await a.open()
    expect(a.verno).toBe(6)
    expect(await a.decks.count()).toBe(0)
  })

  it('NON è reversibile da solo, ma il codice della versione 5 apre lo stesso il database della 6 e ignora i mazzi', async () => {
    // Lo stesso database, scritto dal codice nuovo (versione 6, con un mazzo e schede arrivate da un mazzo)…
    const name = `downgrade-${crypto.randomUUID()}`
    const nu = createDb(name)
    await nu.open()
    await nu.courses.put(course())
    await nu.cards.bulkPut([card('a'), card('b')])
    await nu.decks.put(deck())
    nu.close()
    // …aperto dal codice della versione 5 (dichiara fino alla 5). Dexie 4 non dà errore di versione: apre quello che c'è.
    const old = oldDb(name)
    try {
      await old.open()
      expect(old.verno).toBe(5)
      expect(old.tables.map((t) => t.name)).not.toContain('decks')
      expect(await old.table('cards').count()).toBe(2)
      // …e scrive come sempre. Il codice vecchio non vede la tabella dei mazzi.
      await old.table('cards').put(card('c-vecchio'))
      old.close()
      // Il database resta alla versione 6 (60 per IndexedDB): nulla è sceso. Il codice nuovo lo riapre e ritrova tutto.
      const back = createDb(name)
      await back.open()
      expect(back.verno).toBe(6)
      expect(await back.decks.count()).toBe(1)
      expect(await back.cards.count()).toBe(3)
      back.close()
      const rawVersion = await new Promise<number>((resolve) => {
        const req = indexedDB.open(name)
        req.onsuccess = () => {
          const v = req.result.version
          req.result.close()
          resolve(v)
        }
      })
      expect(rawVersion).toBe(60)
    } finally {
      await Dexie.delete(name)
    }
  })
})
