import { describe, expect, it } from 'vitest'
import { hiddenRanges, keyRanges, lastDisplayRange, lastSentenceRange, maskText } from './mask'

const hidden = (text: string, key = '') => maskText(text, hiddenRanges(text, key))

describe('Completa senza chiave', () => {
  it('con la chiave non cambia nulla: si nasconde la chiave, anche se c’è una formula display', () => {
    const text = 'Vale $$E = mc^2$$ ed è famosa.'
    expect(hiddenRanges(text, 'famosa')).toEqual(keyRanges(text, 'famosa'))
    expect(hidden(text, 'famosa')).toBe('Vale $$E = mc^2$$ ed è ––––––.')
  })

  it('nasconde l’ultima formula display (il corpo, non i $$)', () => {
    expect(hidden('Prima $$a+b$$ poi $$c^2$$ e basta.')).toBe('Prima $$a+b$$ poi $$–––$$ e basta.')
    expect(lastDisplayRange('x $$ab$$ y')).toEqual([4, 6])
  })

  it('le formule in linea non sono display: allora l’ultima proposizione', () => {
    expect(hidden('Una frase. Il limite $L$ è unico.')).toBe('Una frase. –– –––––– ––– – –––––.')
  })

  it('l’ultima proposizione: dall’ultimo punto, senza il punto finale', () => {
    const text = 'Sia $f$ continua. Allora è limitata; inoltre ha massimo.'
    const r = lastSentenceRange(text)!
    expect(text.slice(...r)).toBe('inoltre ha massimo')
    expect(maskText(text, [r])).toBe('Sia $f$ continua. Allora è limitata; ––––––– –– –––––––.')
  })

  it('un testo di una frase sola si nasconde per intero, senza il punto', () => {
    const text = 'Una sola frase.'
    expect(text.slice(...lastSentenceRange(text)!)).toBe('Una sola frase')
  })

  it('il punto di un numero o dentro una formula non divide', () => {
    const text = 'Costa 3.14 euro e $a.b$ vale uno'
    expect(text.slice(...lastSentenceRange(text)!)).toBe(text)
    const t2 = 'Prima. Poi $x = 1. 5$ qui'
    expect(t2.slice(...lastSentenceRange(t2)!)).toBe('Poi $x = 1. 5$ qui')
  })

  it('niente da nascondere: testo vuoto o fatto solo di spazi e punti', () => {
    expect(hiddenRanges('', '')).toEqual([])
    expect(hiddenRanges('  . ', '')).toEqual([])
    expect(hidden('')).toBe('')
  })

  it('un \\$ non è un delimitatore e le posizioni restano quelle del sorgente', () => {
    const text = 'Costa \\$5 qui $$x$$ fine'
    const r = lastDisplayRange(text)!
    expect(text.slice(...r)).toBe('x')
  })
})
