import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import { dailyHours, primarySport } from '../stats/aggregate'
import { parseContentFile } from './cards-io'
import { createDb, type OrbitaDB } from './db'
import { save } from './repo'
import { importSampleDeck, listSampleDecks, matchSampleDecks, sampleDeckFile } from './sample-decks'
import type { Course, Session } from './schema'

const file = parseContentFile(structuredClone(content))
let db: OrbitaDB

beforeEach(() => {
  db = createDb(`deck-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

describe('mazzi d’esempio', () => {
  it('elenca i mazzi del file con il numero di schede', () => {
    const decks = listSampleDecks(file)
    expect(decks).toHaveLength(file.corsi.length)
    expect(decks.reduce((n, d) => n + d.cards, 0)).toBe(file.schede.length)
  })

  it('abbina per nome o per codice, un mazzo a un solo esame', () => {
    const [first, second] = listSampleDecks(file)
    const out = matchSampleDecks(file, [
      { key: 'a', name: first!.name },
      { key: 'b', name: `${first!.name} (copia)` },
      { key: 'c', name: 'Nome inventato', ...(second!.code ? { code: second!.code } : {}) },
      { key: 'd', name: 'Qualcosa di totalmente diverso' },
    ])
    expect(out.find((m) => m.examKey === 'a')).toMatchObject({ deckId: first!.id, score: 1 })
    expect(out.filter((m) => m.deckId === first!.id)).toHaveLength(1)
    expect(out.some((m) => m.examKey === 'd')).toBe(false)
    if (second!.code) expect(out.find((m) => m.examKey === 'c')).toMatchObject({ deckId: second!.id, score: 1 })
  })

  it('il file del mazzo non ha corsi e riferisce le schede al corso scelto', () => {
    const deck = listSampleDecks(file)[0]!
    const out = sampleDeckFile(file, deck.id, 'mio-corso')
    expect(out.corsi).toEqual([])
    expect(out.schede).toHaveLength(deck.cards)
    expect(out.schede.every((s) => s.corso === 'mio-corso')).toBe(true)
  })

  it('importa nel corso scelto senza toccare nome, data e codice, e segna il mazzo', async () => {
    const deck = listSampleDecks(file)[0]!
    const course = await save<Course>(db.courses, { name: 'Mio corso', code: 'XYZ', examDate: '2027-02', sections: ['uno'], difficulty: 3 })
    const r = await importSampleDeck(db, file, deck.id, course.id)
    expect(r.added).toBe(deck.cards)
    const after = (await db.courses.get(course.id))!
    expect(after).toMatchObject({ name: 'Mio corso', code: 'XYZ', examDate: '2027-02', difficulty: 3, sampleDeck: deck.id })
    expect(after.sections).toContain('uno')
    expect(after.sections.length).toBeGreaterThan(1)
    expect(await db.courses.count()).toBe(1)
    expect(await db.cards.where('courseId').equals(course.id).count()).toBe(deck.cards)
  })

  it('rifiuta un corso che non c’è e non scrive nulla', async () => {
    await expect(importSampleDeck(db, file, listSampleDecks(file)[0]!.id, 'manca')).rejects.toMatchObject({ code: 'courseMissing' })
    expect(await db.cards.count()).toBe(0)
  })
})

describe('statistiche per moduli', () => {
  const s = (type: Session['type'], minutes: number): Session => ({ id: `${type}${minutes}`, date: '2026-10-28', minutes, type, updatedAt: 1 })
  it('le ore di lavoro non contano se il tipo non è tra quelli ammessi', () => {
    const sessions = [s('studio', 60), s('lavoro', 120)]
    expect(dailyHours(sessions, ['2026-10-28'])[0]).toMatchObject({ study: 1, work: 2, total: 3 })
    expect(dailyHours(sessions, ['2026-10-28'], ['studio', 'ripasso'])[0]).toMatchObject({ study: 1, work: 0, total: 1 })
  })

  it('lo sport principale è il primo tipo attivo con un obiettivo', () => {
    expect(primarySport([{ type: 'corsa', target: 2 }, { type: 'palestra', target: 0 }, { type: 'nuoto', target: 1 }])).toEqual({ type: 'corsa', target: 2 })
    expect(primarySport([{ type: 'arrampicata', target: 0 }])).toBeUndefined()
    expect(primarySport([])).toBeUndefined()
  })
})
