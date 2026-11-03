import { describe, expect, it } from 'vitest'
import { hasLatex, latexSource } from './latex'
import { modeForBox, modeForCard, suggestedOutcome } from './leitner'
import { applyValue, normalizeTyped, startTyping, typingStats } from './typing'

describe('sorgente da battere in modalità LaTeX', () => {
  it('prende il sorgente delle formule, senza i delimitatori', () => {
    expect(latexSource('L’energia è $E = h \\nu$ e basta.')).toBe('E = h \\nu')
  })

  it('più formule, in ordine, separate da uno spazio; il display vale come le altre', () => {
    expect(latexSource('Se $a_n$ allora $$\\sum_{k=1}^{n} k$$ con $b^2$.')).toBe('a_n \\sum_{k=1}^{n} k b^2')
  })

  it('riduce spazi e a capo dentro la formula a uno spazio solo', () => {
    expect(latexSource('$$\n  a  =\n  b\n$$')).toBe('a = b')
  })

  it('un dollaro scritto \\$ o un testo senza formule non dà nulla', () => {
    expect(latexSource('costa 5\\$ e 10\\$')).toBe('')
    expect(latexSource('H_n senza dollari')).toBe('')
    expect(latexSource('$ non chiuso')).toBe('')
    expect(hasLatex('$x$')).toBe(true)
    expect(hasLatex('niente')).toBe(false)
  })

  it('\\$ dentro una formula resta il dollaro di TeX', () => {
    expect(latexSource('$a \\$ b$')).toBe('a \\$ b')
  })
})

describe('modalità della scheda', () => {
  it('in scatola 2 le schede con formule battono il LaTeX al posto di Completa', () => {
    expect(modeForCard(2, 'vale $x^2$')).toBe('latex')
    expect(modeForCard(2, 'vale x^2')).toBe('completa')
    expect(modeForCard(2, 'costa 5\\$')).toBe('completa')
  })

  it('le altre scatole non cambiano, formule o no', () => {
    for (const box of [undefined, 1, 3, 4, 5] as const) {
      expect(modeForCard(box, 'vale $x^2$')).toBe(modeForBox(box))
      expect(modeForCard(box, 'vale x^2')).toBe(modeForBox(box))
    }
    expect(modeForCard(1, '$x$')).toBe('copia')
    expect(modeForCard(3, '$x$')).toBe('nome')
  })

  it('l’esito suggerito in LaTeX è la precisione, come in Copia e Completa', () => {
    expect(suggestedOutcome('latex', 0.97)).toBe(true)
    expect(suggestedOutcome('latex', 0.9)).toBe(false)
  })
})

describe('battitura del sorgente', () => {
  const target = latexSource('$E = \\frac{h c}{\\lambda}$')

  it('colora e conta come le altre modalità, per tasto fisico', () => {
    let s = startTyping(target)
    s = applyValue(s, 'E = \\frac{', 1000)
    expect(s.typed).toBe('E = \\frac{')
    expect(s.misses).toBe(0)
    // `{` si scrive con Alt Gr + Maiusc sul tasto di è: gli errori e i tentativi vanno lì
    expect(s.keyHits['è']).toBe(1)
    s = applyValue(s, 'E = \\frac[', 2000)
    expect(s.misses).toBe(1)
    expect(s.keyErrors['è']).toBe(1)
    expect(s.wrongAt).toEqual([9])
  })

  it('si completa col sorgente intero e la precisione tiene conto degli errori', () => {
    let s = startTyping(target)
    s = applyValue(s, target, 5000)
    const stats = typingStats(s)
    expect(stats.done && stats.exact).toBe(true)
    expect(stats.accuracy).toBe(1)
  })

  it('l’accento grave del LaTeX non diventa un apostrofo quando è nel testo', () => {
    expect(normalizeTyped('a`b’c')).toBe("a'b'c")
    expect(normalizeTyped('a`b’c', '``x')).toBe("a`b'c")
    let s = startTyping('``a')
    s = applyValue(s, '``a', 1)
    expect(s.misses).toBe(0)
  })
})
