import { describe, expect, it } from 'vitest'
import { href, parseHash } from './router'

describe('parseHash', () => {
  it('riconosce le sezioni', () => {
    expect(parseHash('#/agenda').id).toBe('agenda')
    expect(parseHash('#/Ripasso').id).toBe('ripasso')
    expect(parseHash('#/regole').id).toBe('regole')
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
    expect(href('ripasso', { materia: 'sdm' })).toBe('#/ripasso?materia=sdm')
    expect(parseHash(href('ripasso', { materia: 'sdm' })).query.get('materia')).toBe('sdm')
  })
})
