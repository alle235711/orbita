import { describe, expect, it } from 'vitest'
import { renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { card, course, deck } from '../test/deck-fixtures'
import { buildDeckFile, cleanMeta, DECK_FORMAT, EMPTY_META, parseDeckFile, sectionsOf } from './file'

const message = (fn: () => unknown): string => {
  try {
    fn()
  } catch (e) {
    return renderError(e, i18nFor('it'))
  }
  return ''
}

const file = () => buildDeckFile(deck(), course(), [card('b'), card('a', { formulaReading: 'x con n', needsFix: true }), card('gone', { deletedAt: 9 })], '2026-11-03')

describe('buildDeckFile', () => {
  it('scrive metadati e schede vive, in ordine di id, senza stato di ripasso', () => {
    const f = file()
    expect(f).toMatchObject({ app: 'orbita', tipo: 'mazzo', versione: DECK_FORMAT, esportato: '2026-11-03' })
    expect(f.mazzo).toEqual({
      id: 'deck-1',
      nome: 'Analisi 1, appunti',
      autore: 'Ada Demo',
      ateneo: 'Università di Prova',
      corso: 'Analisi 1',
      anno: '2026/2027',
      licenza: 'CC BY 4.0',
      note: 'Fatto a mano.',
      aggiornato: 500,
      sezioni: ['Limiti'],
    })
    expect(f.schede.map((s) => s.id)).toEqual(['a', 'b'])
    expect(f.schede[0]).toMatchObject({ letturaFormula: 'x con n', daCorreggere: true, aggiornata: 100 })
    expect(f.schede[1]).not.toHaveProperty('letturaFormula')
    expect(f.schede[1]).not.toHaveProperty('daCorreggere')
    expect(JSON.stringify(f)).not.toMatch(/userEdited|box|due|courseId/)
  })

  it('è deterministico: stesso ingresso, stesso JSON', () => {
    expect(JSON.stringify(file())).toBe(JSON.stringify(file()))
  })

  it('le sezioni seguono l’ordine del corso e aggiungono quelle usate ma non elencate', () => {
    expect(sectionsOf({ sections: ['Serie', 'Limiti', 'Vuota'] }, [card('a'), card('b', { section: 'Serie' }), card('c', { section: 'Extra' })])).toEqual(['Serie', 'Limiti', 'Extra'])
  })
})

describe('parseDeckFile', () => {
  it('legge quello che build scrive, anche passando da JSON (ciclo identico)', () => {
    const f = file()
    expect(parseDeckFile(JSON.parse(JSON.stringify(f)))).toEqual(f)
  })

  it('ignora i campi sconosciuti e tollera i metadati facoltativi mancanti', () => {
    const f = parseDeckFile({ app: 'orbita', tipo: 'mazzo', versione: 1, extra: 1, mazzo: { id: 'd', nome: ' Nome ', quando: 'ieri' }, schede: [] })
    expect(f.mazzo).toEqual({ id: 'd', nome: 'Nome', autore: '', ateneo: '', corso: '', anno: '', licenza: '', note: '', aggiornato: 0, sezioni: [] })
    expect(f).not.toHaveProperty('extra')
  })

  it('rifiuta ciò che non è un mazzo, con un messaggio chiaro', () => {
    for (const bad of [null, 42, 'x', [], {}, { app: 'orbita' }, { app: 'altro', tipo: 'mazzo', versione: 1 }, { app: 'orbita', tipo: 'backup', versione: 1 }, { app: 'orbita', tipo: 'mazzo' }, { app: 'orbita', tipo: 'mazzo', versione: 0 }, { app: 'orbita', tipo: 'mazzo', versione: 1.5 }]) {
      expect(message(() => parseDeckFile(bad))).toBe('Il file non è un mazzo di Orbita.')
    }
  })

  it('rifiuta una versione sconosciuta (più nuova) senza provare a leggerla', () => {
    const f = { ...file(), versione: DECK_FORMAT + 1, schede: 'qualcosa di nuovo' }
    expect(message(() => parseDeckFile(f))).toBe('Questo mazzo viene da una versione più nuova di Orbita: aggiorna l’app e riprova.')
  })

  it('rifiuta intestazioni e schede malformate dicendo quale', () => {
    const ok = JSON.parse(JSON.stringify(file()))
    const bad = (mutate: (f: typeof ok) => void) => {
      const f = structuredClone(ok)
      mutate(f)
      return message(() => parseDeckFile(f))
    }
    expect(bad((f) => delete f.mazzo.id)).toMatch(/non ha un id e un nome/)
    expect(bad((f) => (f.mazzo.nome = '   '))).toMatch(/non ha un id e un nome/)
    expect(bad((f) => (f.schede = {}))).toMatch(/elenco delle schede/)
    expect(bad((f) => (f.schede[1] = 7))).toBe('La scheda numero 2 del mazzo non è un oggetto.')
    expect(bad((f) => delete f.schede[0].testo)).toBe('La scheda a del mazzo non ha il campo «testo» o non è valido.')
    expect(bad((f) => delete f.schede[0].id)).toBe('La scheda numero 1 del mazzo non ha il campo «id» o non è valido.')
    expect(bad((f) => (f.schede[0].id = ''))).toBe('La scheda numero 1 del mazzo non ha il campo «id» o non è valido.')
    expect(bad((f) => (f.schede[0].aggiornata = 'ieri'))).toBe('La scheda a del mazzo non ha il campo «aggiornata» o non è valido.')
    expect(bad((f) => (f.schede[0].aggiornata = -1))).toMatch(/aggiornata/)
    expect(bad((f) => (f.schede[0].cancellata = 'x'))).toMatch(/cancellata/)
    expect(bad((f) => (f.schede[1].id = 'a'))).toBe('L’id a compare due volte nel mazzo.')
  })
})

describe('cleanMeta', () => {
  it('toglie gli spazi ai bordi e copre tutti i campi', () => {
    expect(cleanMeta({ ...EMPTY_META, name: '  A ', notes: ' x\n' })).toEqual({ ...EMPTY_META, name: 'A', notes: 'x' })
  })
})
