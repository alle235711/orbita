import { describe, expect, it } from 'vitest'
import { href, parseHash, ROUTES } from './router'

describe('parseHash', () => {
  it('riconosce le sezioni', () => {
    expect(parseHash('#/agenda').id).toBe('agenda')
    expect(parseHash('#/Ripasso').id).toBe('ripasso')
    expect(parseHash('#/regole').id).toBe('regole')
    expect(parseHash('#/libretto').id).toBe('libretto')
  })

  it('l’elenco delle sezioni è in ordine', () => {
    expect([...ROUTES]).toEqual(['oggi', 'agenda', 'briefing', 'libretto', 'statistiche', 'ripasso', 'dattilografia', 'dati', 'regole'])
  })

  it('torna a Oggi per hash vuoti o sconosciuti', () => {
    expect(parseHash('').id).toBe('oggi')
    expect(parseHash('#/').id).toBe('oggi')
    expect(parseHash('#/marte').id).toBe('oggi')
  })

  it('legge i parametri', () => {
    const route = parseHash('#/agenda?giorno=2026-10-27&vista=settimana')
    expect(route.id).toBe('agenda')
    expect(route.query.get('giorno')).toBe('2026-10-27')
    expect(route.query.get('vista')).toBe('settimana')
  })
})

describe('href', () => {
  it('costruisce hash con e senza parametri', () => {
    expect(href('briefing')).toBe('#/briefing')
    expect(href('ripasso', { materia: 'corso-prova' })).toBe('#/ripasso?materia=corso-prova')
    expect(parseHash(href('ripasso', { materia: 'corso-prova' })).query.get('materia')).toBe('corso-prova')
  })
})
