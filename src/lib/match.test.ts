import { describe, expect, it } from 'vitest'
import { bestMatch, matchScore, normalizeName, tokens, MATCH_THRESHOLD } from './match'

describe('normalizeName e tokens', () => {
  it('toglie accenti, apostrofi e punteggiatura', () => {
    expect(normalizeName('  Metodi per l’Analisi, II!  ')).toBe('metodi per l analisi ii')
    expect(normalizeName('Città & Università')).toBe('citta universita')
  })

  it('scarta articoli e preposizioni, tiene cifre e parole da 3 lettere', () => {
    expect(tokens('Teoria dei Gruppi')).toEqual(['teoria', 'gruppi'])
    expect(tokens('Analisi 2 e the Fisica')).toEqual(['analisi', '2', 'fisica'])
    expect(tokens('')).toEqual([])
  })
})

describe('matchScore', () => {
  it('uguali 1, senza parole in comune 0, vuoti 0', () => {
    expect(matchScore('Fisica Moderna', 'fisica moderna')).toBe(1)
    expect(matchScore('Fisica Moderna', 'Storia Antica')).toBe(0)
    expect(matchScore('', 'Fisica')).toBe(0)
    expect(matchScore('di la', 'il lo')).toBe(0)
  })

  it('conta le parole in comune su quelle totali', () => {
    expect(matchScore('Fisica Moderna', 'Fisica Generale')).toBeCloseTo(1 / 3)
    expect(matchScore('Analisi Matematica 1', 'Analisi Matematica')).toBeCloseTo(2 / 3)
  })

  it('un prefisso di almeno 4 lettere vale come parola uguale, uno più corto no', () => {
    expect(matchScore('Geometria', 'Geom')).toBe(1)
    expect(matchScore('Geometria', 'Geo')).toBe(0)
  })

  it('abbina una parola una volta sola', () => {
    expect(matchScore('Analisi Analisi', 'Analisi')).toBeCloseTo(1 / 2)
  })
})

describe('bestMatch', () => {
  const list = [
    { id: 'a', name: 'Analisi Matematica 1', code: 'AM-1' },
    { id: 'b', name: 'Analisi Matematica 2' },
    { id: 'c', name: 'Fisica Generale' },
  ]

  it('sceglie il migliore sopra la soglia, altrimenti null', () => {
    expect(bestMatch('Analisi matematica 2', list)).toEqual({ id: 'b', score: 1 })
    expect(bestMatch('Storia', list)).toBeNull()
    expect(MATCH_THRESHOLD).toBe(0.5)
    expect(bestMatch('Analisi', list, { threshold: 0.2 })?.id).toBe('a')
  })

  it('lo stesso codice vale 1, senza badare a maiuscole e spazi; il codice vuoto non conta', () => {
    expect(bestMatch('Altro nome', list, { code: ' am-1 ' })).toEqual({ id: 'a', score: 1 })
    expect(bestMatch('Altro nome', list, { code: '' })).toBeNull()
  })

  it('a pari punteggio vince il primo e l’ingresso non cambia', () => {
    const same = [
      { id: 'x', name: 'Fisica' },
      { id: 'y', name: 'Fisica' },
    ]
    const copy = structuredClone(same)
    expect(bestMatch('Fisica', same)?.id).toBe('x')
    expect(same).toEqual(copy)
  })
})
