import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TEX_GOOD, TEX_MALFORMED } from '../test/tex-fixtures'
import { parseTexFiles } from '../tex/parse'
import { previewRows } from '../tex/plan'
import { createDb, type OrbitaDB } from './db'
import { patch, save } from './repo'
import type { Course } from './schema'
import { importTexCards } from './tex-import'

let db: OrbitaDB
const rows = () => previewRows(parseTexFiles([{ name: 'analisi.tex', text: TEX_GOOD }, { name: 'rotto.tex', text: TEX_MALFORMED }]))

beforeEach(() => {
  db = createDb(`tex-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})

const newCourse = (extra: Partial<Course> = {}) => save<Course>(db.courses, { name: 'Analisi', sections: ['Limiti'], difficulty: 2, ...extra })

describe('importazione da .tex', () => {
  it('scrive le schede nel corso, con chiave vuota, e aggiunge le sezioni nuove', async () => {
    const course = await newCourse()
    const r = await importTexCards(db, course.id, rows())
    const cards = await db.cards.toArray()
    expect(r).toMatchObject({ added: rows().length, updated: 0, unchanged: 0, keptEdited: 0 })
    expect(cards).toHaveLength(rows().length)
    expect(cards.every((c) => c.courseId === course.id && c.key === '' && !c.userEdited && !c.needsFix && c.updatedAt === 0)).toBe(true)
    expect(cards.every((c) => c.id.startsWith(`tex:${course.id}:`))).toBe(true)
    expect((await db.courses.get(course.id))!.sections).toEqual(['Limiti', "Un po' di esempi", 'Derivate', 'Prima parte'])
    // nessuno stato di ripasso: sono schede nuove, come le altre schede importate
    expect(await db.cardState.count()).toBe(0)
  })

  it('reimportare lo stesso file non duplica e non tocca il corso', async () => {
    const course = await newCourse()
    await importTexCards(db, course.id, rows())
    const before = await db.courses.get(course.id)
    const r = await importTexCards(db, course.id, rows())
    expect(r).toMatchObject({ added: 0, updated: 0, unchanged: rows().length })
    expect(await db.cards.count()).toBe(rows().length)
    expect(await db.courses.get(course.id)).toEqual(before)
  })

  it('una scheda modificata nell’app resta com’è; una cambiata nel file si aggiorna', async () => {
    const course = await newCourse()
    const list = rows()
    await importTexCards(db, course.id, list)
    const [first, second] = [list[0]!, list[1]!]
    const idFirst = `tex:${course.id}:analisi.tex:${first.card.env}:${first.card.number}`
    await patch(db.cards, idFirst, { text: 'Cambiata da me', userEdited: true })
    const edited = list.map((r) => (r === second ? { ...r, card: { ...r.card, text: 'Nuovo testo dal file' } } : r))
    const r = await importTexCards(db, course.id, edited)
    expect(r).toMatchObject({ added: 0, updated: 1, keptEdited: 1 })
    expect((await db.cards.get(idFirst))!.text).toBe('Cambiata da me')
  })

  it('importa solo le righe scelte', async () => {
    const course = await newCourse()
    const r = await importTexCards(db, course.id, rows().slice(0, 2))
    expect(r.added).toBe(2)
    expect(await db.cards.count()).toBe(2)
  })

  it('un corso che non c’è più dà un errore con codice', async () => {
    await expect(importTexCards(db, 'sparito', rows())).rejects.toMatchObject({ code: 'courseMissing' })
    const course = await newCourse()
    await patch(db.courses, course.id, { deletedAt: Date.now() })
    await expect(importTexCards(db, course.id, rows())).rejects.toMatchObject({ code: 'courseMissing' })
  })
})
