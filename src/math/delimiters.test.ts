import { describe, expect, it } from 'vitest'
import { hasDisplayMath, hasMath, splitMath } from './delimiters'

const text = (value: string) => ({ type: 'text', value })
const inline = (value: string) => ({ type: 'inline', value })
const display = (value: string) => ({ type: 'display', value })

describe('splitMath', () => {
  it('testo senza formule: un solo pezzo, uguale al sorgente', () => {
    expect(splitMath('Nessuna formula qui.')).toEqual([text('Nessuna formula qui.')])
    expect(splitMath('')).toEqual([])
  })

  it('formula in linea e in display', () => {
    expect(splitMath('Livelli $E_n = -13{,}6/n^2$ eV.')).toEqual([text('Livelli '), inline('E_n = -13{,}6/n^2'), text(' eV.')])
    expect(splitMath('Vale $$\\hbar \\omega$$ sempre')).toEqual([text('Vale '), display('\\hbar \\omega'), text(' sempre')])
  })

  it('$$ ha la precedenza su $', () => {
    expect(splitMath('$$a$$')).toEqual([display('a')])
    expect(splitMath('$$x$$ e $y$')).toEqual([display('x'), text(' e '), inline('y')])
  })

  it('$ in mezzo al testo resta un dollaro: chi apre non è seguito da uno spazio, chi chiude non precede una cifra', () => {
    expect(splitMath('Costa 5$ e quello 10$.')).toEqual([text('Costa 5$ e quello 10$.')])
    expect(splitMath('Da $ 3 a $ 4')).toEqual([text('Da $ 3 a $ 4')])
    expect(splitMath('tra $5 e $6')).toEqual([text('tra $5 e $6')])
    expect(splitMath('$a $b$')).toEqual([text('$a '), inline('b')])
  })

  it('\\$ è un dollaro letterale nel testo e resta \\$ dentro una formula', () => {
    expect(splitMath('Prezzo \\$5, formula $a$')).toEqual([text('Prezzo $5, formula '), inline('a')])
    expect(splitMath('\\$x\\$')).toEqual([text('$x$')])
    expect(splitMath('$\\$ + 1$')).toEqual([inline('\\$ + 1')])
    expect(splitMath('$$a \\$$ b$$')).toEqual([display('a \\$$ b')])
  })

  it('$$ adiacenti e annidati: si legge da sinistra, senza eccezioni', () => {
    expect(splitMath('$a$$b$')).toEqual([inline('a'), inline('b')])
    expect(splitMath('$$a$$$$b$$')).toEqual([display('a'), display('b')])
    expect(splitMath('$$ a $b$ c $$')).toEqual([display('a $b$ c')])
    expect(splitMath('$a $$ b$')).toEqual([text('$a $$ b$')])
  })

  it('una formula non chiusa resta testo, delimitatori compresi', () => {
    expect(splitMath('Inizio $E_n senza fine')).toEqual([text('Inizio $E_n senza fine')])
    expect(splitMath('Inizio $$E_n senza fine')).toEqual([text('Inizio $$E_n senza fine')])
    expect(splitMath('$$a$ e $b$')).toEqual([text('$$a$ e '), inline('b')])
    expect(splitMath('finisce con $')).toEqual([text('finisce con $')])
    expect(splitMath('$')).toEqual([text('$')])
  })

  it('formule vuote restano testo', () => {
    expect(splitMath('$$$$')).toEqual([text('$$$$')])
    expect(splitMath('a $$  $$ b')).toEqual([text('a $$  $$ b')])
    expect(splitMath('$$')).toEqual([text('$$')])
  })

  it('non lancia mai, qualunque cosa riceva', () => {
    const nasty = ['$', '$$', '$$$', '\\', '\\$', '$\\', '$$\\$$', '$a\\', '$$a\\', '$}$', '$\\frac{$', '\\\\$a$']
    for (const s of nasty) expect(() => splitMath(s)).not.toThrow()
    // il testo ricomposto dai pezzi di testo e dalle formule copre tutto il sorgente
    for (const s of nasty) expect(splitMath(s).length).toBeGreaterThan(0)
  })

  it('hasMath e hasDisplayMath', () => {
    expect(hasMath('E = mc^2')).toBe(false)
    expect(hasMath('costa 5$')).toBe(false)
    expect(hasMath('$E$')).toBe(true)
    expect(hasDisplayMath('$E$')).toBe(false)
    expect(hasDisplayMath('e poi $$E$$')).toBe(true)
  })
})
