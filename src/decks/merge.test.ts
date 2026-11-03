import { describe, expect, it } from 'vitest'
import { card, course, deck } from '../test/deck-fixtures'
import type { Card } from '../db/schema'
import { buildDeckFile, parseDeckFile, type DeckCard, type DeckFile } from './file'
import { importedCourseId, planCardMerge, planDeckMerge, targetCourseId } from './merge'

const incoming = (id: string, over: Partial<DeckCard> = {}): DeckCard => ({ id, sezione: 'Limiti', tipo: 'definizione', titolo: `Scheda ${id}`, testo: `Testo della scheda ${id}, con $x_n \\to 0$.`, chiave: 'x_n', aggiornata: 100, ...over })
const merge = (inc: DeckCard[], local: (Card | undefined)[]) => planCardMerge(inc, local, 'c1')

describe('fusione delle schede', () => {
  it('nuove: si aggiungono nel corso di destinazione, non modificate dall’utente, con il timbro del file', () => {
    const r = merge([incoming('a', { aggiornata: 77, letturaFormula: 'x con n', daCorreggere: true })], [undefined])
    expect(r.summary).toEqual({ added: 1, updated: 0, unchanged: 0, skipped: 0, keptEdited: 0, elsewhere: 0 })
    expect(r.rows).toEqual([{ id: 'a', courseId: 'c1', section: 'Limiti', kind: 'definizione', title: 'Scheda a', text: 'Testo della scheda a, con $x_n \\to 0$.', key: 'x_n', needsFix: true, userEdited: false, formulaReading: 'x con n', updatedAt: 77 }])
  })

  it('uguali: stesso contenuto, nessuna scrittura, qualunque sia il timbro', () => {
    for (const aggiornata of [1, 100, 999]) {
      const r = merge([incoming('a', { aggiornata })], [card('a')])
      expect(r.summary.unchanged).toBe(1)
      expect(r.rows).toEqual([])
    }
  })

  it('più nuova nel file: si aggiorna, mantenendo il timbro del file e togliendo il vecchio campo di lettura', () => {
    const r = merge([incoming('a', { testo: 'Nuovo testo', aggiornata: 200 })], [card('a', { formulaReading: 'vecchia lettura', updatedAt: 100 })])
    expect(r.summary).toMatchObject({ updated: 1, skipped: 0 })
    expect(r.rows[0]).toMatchObject({ id: 'a', text: 'Nuovo testo', updatedAt: 200, userEdited: false })
    expect(r.rows[0]).not.toHaveProperty('formulaReading')
  })

  it('più recente qui, o pari: la versione locale resta (saltata)', () => {
    for (const updatedAt of [100, 300]) {
      const r = merge([incoming('a', { testo: 'Altro testo', aggiornata: 100 })], [card('a', { updatedAt })])
      expect(r.summary).toMatchObject({ skipped: 1, keptEdited: 0, updated: 0 })
      expect(r.rows).toEqual([])
    }
  })

  it('modificata dall’utente: non si sovrascrive mai, nemmeno se il file è più nuovo', () => {
    const r = merge([incoming('a', { testo: 'Altro testo', aggiornata: 9999 })], [card('a', { userEdited: true, updatedAt: 5 })])
    expect(r.summary).toEqual({ added: 0, updated: 0, unchanged: 0, skipped: 1, keptEdited: 1, elsewhere: 0 })
    expect(r.rows).toEqual([])
    // nemmeno con una cancellazione
    expect(merge([incoming('a', { aggiornata: 9999, cancellata: 9999 })], [card('a', { userEdited: true })]).rows).toEqual([])
  })

  it('un id già presente in un altro corso non si sposta', () => {
    const r = merge([incoming('a', { testo: 'Altro', aggiornata: 9999 })], [card('a', { courseId: 'altro' })])
    expect(r.summary).toEqual({ added: 0, updated: 0, unchanged: 0, skipped: 1, keptEdited: 0, elsewhere: 1 })
    expect(r.rows).toEqual([])
  })

  it('cancellata nel file: la scheda locale viva e più vecchia si cancella (in modo logico); se è più nuova resta', () => {
    const old = merge([incoming('a', { aggiornata: 300, cancellata: 300 })], [card('a', { updatedAt: 100 })])
    expect(old.summary.updated).toBe(1)
    expect(old.rows[0]).toMatchObject({ id: 'a', deletedAt: 300, updatedAt: 300, text: card('a').text })
    const fresh = merge([incoming('a', { aggiornata: 50, cancellata: 50 })], [card('a', { updatedAt: 100 })])
    expect(fresh.summary.skipped).toBe(1)
    expect(fresh.rows).toEqual([])
  })

  it('cancellata nel file e già cancellata qui, o mai vista qui: uguale, niente da scrivere', () => {
    expect(merge([incoming('a', { cancellata: 300, aggiornata: 300 })], [card('a', { deletedAt: 5, updatedAt: 5 })]).summary.unchanged).toBe(1)
    const never = merge([incoming('a', { cancellata: 300, aggiornata: 300 })], [undefined])
    expect(never.summary).toMatchObject({ unchanged: 1, added: 0 })
    expect(never.rows).toEqual([])
  })

  it('cancellata qui: resta cancellata se il file non è più recente, torna se lo è', () => {
    const stays = merge([incoming('a', { aggiornata: 100 })], [card('a', { deletedAt: 500, updatedAt: 500 })])
    expect(stays.summary).toMatchObject({ skipped: 1, updated: 0 })
    expect(stays.rows).toEqual([])
    const back = merge([incoming('a', { aggiornata: 600 })], [card('a', { deletedAt: 500, updatedAt: 500 })])
    expect(back.summary).toMatchObject({ updated: 1, skipped: 0 })
    expect(back.rows[0]).not.toHaveProperty('deletedAt')
    expect(back.rows[0]).toMatchObject({ updatedAt: 600, userEdited: false })
  })

  it('il resoconto somma tutte le schede del file', () => {
    const inc = ['n', 'u', 'e', 's', 'k', 'x'].map((id) => incoming(id, id === 'u' ? { testo: 'cambiato', aggiornata: 200 } : id === 's' ? { testo: 'cambiato' } : {}))
    const local = [undefined, card('u'), card('e'), card('s', { updatedAt: 500 }), card('k', { userEdited: true }), card('x', { courseId: 'z' })]
    const r = merge(inc, local)
    expect(r.summary).toEqual({ added: 1, updated: 1, unchanged: 1, skipped: 3, keptEdited: 1, elsewhere: 1 })
    expect(r.summary.added + r.summary.updated + r.summary.unchanged + r.summary.skipped).toBe(inc.length)
  })
})

describe('fusione del mazzo', () => {
  const file = (over: Partial<DeckFile['mazzo']> = {}): DeckFile => {
    const f = buildDeckFile(deck(), course(), [card('a'), card('b')], '2026-11-03')
    return { ...f, mazzo: { ...f.mazzo, ...over } }
  }

  it('mazzo nuovo: corso con id stabile, origine con l’autore del file, timbro del file', () => {
    const f = file()
    const plan = planDeckMerge(f, undefined, [undefined, undefined])
    expect(plan.deck).toBe('new')
    expect(targetCourseId(f, undefined)).toBe('deck:deck-1')
    expect(importedCourseId('deck-1')).toBe('deck:deck-1')
    expect(plan.deckRow).toEqual({ id: 'deck-1', courseId: 'deck:deck-1', name: 'Analisi 1, appunti', author: 'Ada Demo', university: 'Università di Prova', course: 'Analisi 1', year: '2026/2027', license: 'CC BY 4.0', notes: 'Fatto a mano.', origin: { author: 'Ada Demo', university: 'Università di Prova' }, updatedAt: 500 })
    expect(plan.rows.every((r) => r.courseId === 'deck:deck-1')).toBe(true)
  })

  it('mazzo già presente: le schede vanno nel suo corso; stesse informazioni = uguale', () => {
    const local = deck({ courseId: 'mio-corso' })
    const plan = planDeckMerge(file(), local, [card('a', { courseId: 'mio-corso' }), card('b', { courseId: 'mio-corso' })])
    expect(plan.deck).toBe('unchanged')
    expect(plan.deckRow).toBeUndefined()
    expect(plan.cards).toMatchObject({ unchanged: 2, added: 0 })
  })

  it('informazioni più recenti nel file: si aggiornano, l’origine e il corso locale restano', () => {
    const local = deck({ courseId: 'mio-corso', origin: { author: 'Ada Demo', university: 'X' }, updatedAt: 400 })
    const plan = planDeckMerge(file({ nome: 'Nome nuovo', aggiornato: 900 }), local, [undefined, undefined])
    expect(plan.deck).toBe('updated')
    expect(plan.deckRow).toMatchObject({ name: 'Nome nuovo', courseId: 'mio-corso', origin: { university: 'X' }, updatedAt: 900 })
  })

  it('informazioni più vecchie nel file: restano le tue (saltato)', () => {
    const local = deck({ courseId: 'mio-corso', name: 'Il mio nome', updatedAt: 800 })
    const plan = planDeckMerge(file({ aggiornato: 500 }), local, [undefined, undefined])
    expect(plan.deck).toBe('skipped')
    expect(plan.deckRow).toBeUndefined()
  })

  it('un mazzo cancellato qui conta come nuovo e prende un corso nuovo', () => {
    const gone = deck({ deletedAt: 5 })
    expect(targetCourseId(file(), gone)).toBe('deck:deck-1')
    expect(planDeckMerge(file(), gone, [undefined, undefined]).deck).toBe('new')
  })

  it('ciclo completo di dati: esporta, rilegge dal JSON, pianifica su un database vuoto e ottiene le stesse schede', () => {
    const cards = [card('a', { formulaReading: 'lettura' }), card('b', { needsFix: true, key: '' })]
    const f = parseDeckFile(JSON.parse(JSON.stringify(buildDeckFile(deck(), course(), cards, '2026-11-03'))))
    const plan = planDeckMerge(f, undefined, [undefined, undefined])
    expect(plan.rows).toEqual(cards.map((c) => ({ ...c, courseId: 'deck:deck-1' })))
  })
})
