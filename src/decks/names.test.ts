import { describe, expect, it } from 'vitest'
import { deckFileName } from './names'
import { formatSize } from './size'
import { itFormat } from '../i18n/format/it'

describe('deckFileName', () => {
  it('toglie accenti e simboli', () => {
    expect(deckFileName('Analisi 1, appunti di Perché?', 'json')).toBe('orbita-mazzo-analisi-1-appunti-di-perche.json')
    expect(deckFileName('   ', 'orbita')).toBe('orbita-mazzo-senza-nome.orbita')
    expect(deckFileName('???', 'json')).toBe('orbita-mazzo-senza-nome.json')
  })
  it('accorcia i nomi lunghi senza lasciare trattini finali', () => {
    const name = deckFileName('a'.repeat(39) + ' bcdef', 'json')
    expect(name).toBe(`orbita-mazzo-${'a'.repeat(39)}.json`)
  })
})

describe('formatSize', () => {
  it('byte sotto i mille, KB sopra', () => {
    expect(formatSize(666, itFormat)).toBe('666 byte')
    expect(formatSize(999, itFormat)).toBe('999 byte')
    expect(formatSize(14_320, itFormat)).toBe('14,3 KB')
  })
})
