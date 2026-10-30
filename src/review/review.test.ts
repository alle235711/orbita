import { describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import type { CardState } from '../db/schema'
import { KEYS, ROWS, strokeFor, strokeHint } from './keyboard'
import { applyReview, modeForBox, suggestedOutcome } from './leitner'
import { inRanges, keyRanges, maskText } from './mask'
import { alignWords, similarity, tokenize } from './similarity'
import { applyValue, charStates, freeWpm, nextChar, normalizeTyped, startTyping, typingStats } from './typing'

describe('tastiera italiana', () => {
  it('ha righe larghe 840 come nel mockup', () => {
    for (const row of ROWS.slice(0, 4)) {
      const width = row.reduce((w, k) => w + k.width, 0) + (row.length - 1) * 6
      expect(width).toBe(840)
    }
  })

  it('mette la ù nella riga superiore, a destra del +, e il < > nell’ultima', () => {
    const top = ROWS[1]!.map((k) => k.id)
    expect(top.indexOf('ù')).toBe(top.indexOf('+') + 1)
    expect(ROWS[3]!.map((k) => k.id)).not.toContain('<')
    expect(ROWS[4]!.map((k) => k.id)).toContain('<')
    expect(ROWS[2]!.at(-1)!.id).toBe('enter')
  })

  it('assegna le dita della SPEC §5', () => {
    const finger = (id: string) => KEYS.get(id)!.finger
    expect(['\\', '1', 'q', 'a', 'z', '0', "'", 'ì', 'p', 'è', '+', 'ù', 'ò', 'à', '-'].map(finger).every((f) => f === 'mignolo')).toBe(true)
    expect(['2', 'w', 's', 'x', '9', 'o', 'l', '.'].map(finger).every((f) => f === 'anulare')).toBe(true)
    expect(['3', 'e', 'd', 'c', '8', 'i', 'k', ','].map(finger).every((f) => f === 'medio')).toBe(true)
    expect(['4', '5', 'r', 't', 'f', 'g', 'v', 'b', '6', '7', 'y', 'u', 'h', 'j', 'n', 'm'].map(finger).every((f) => f === 'indice')).toBe(true)
    expect(finger('space')).toBe('pollice')
    expect(KEYS.get('f')!.bump && KEYS.get('j')!.bump).toBe(true)
  })

  it('usa lo Shift della mano opposta', () => {
    expect(strokeFor('E')).toMatchObject({ key: { id: 'e' }, shift: { id: 'rshift' } })
    expect(strokeFor('P')).toMatchObject({ key: { id: 'p' }, shift: { id: 'lshift' } })
    expect(strokeFor('é')).toMatchObject({ key: { id: 'è' }, shift: { id: 'lshift' } })
    expect(strokeFor('_')).toMatchObject({ key: { id: '-' }, shift: { id: 'lshift' } })
    expect(strokeFor('|')).toMatchObject({ key: { id: '\\' }, shift: { id: 'rshift' } })
    expect(strokeFor('(')).toMatchObject({ key: { id: '8' } })
    expect(strokeFor('a')).toMatchObject({ key: { id: 'a' } })
    expect(strokeFor('a')!.shift).toBeUndefined()
    expect(strokeFor('€')).toBeNull() // serve Alt Gr
  })

  it('sa scrivere ogni carattere delle 502 schede', () => {
    const chars = new Set(content.schede.flatMap((s) => [...s.titolo, ...s.testo]))
    const missing = [...chars].filter((c) => !strokeFor(c))
    expect(missing).toEqual([])
  })

  it('suggerisce dito e Shift a parole', () => {
    expect(strokeHint('e')).toBe('«e», medio sinistro')
    expect(strokeHint('E')).toBe('«E», medio sinistro con lo Shift destro')
    expect(strokeHint(' ')).toBe('Spazio, col pollice')
    expect(strokeHint(':')).toBe('«:», anulare destro con lo Shift sinistro')
  })
})

describe('motore di battitura', () => {
  const target = 'Il raggio di Bohr'

  it('colora corretto, sbagliato e carattere corrente', () => {
    let s = startTyping(target)
    s = applyValue(s, 'Il rax', 1000)
    expect(charStates(s).slice(0, 7)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'wrong', 'current'])
    expect(nextChar(s)).toBe('g')
  })

  it('conta nella precisione anche gli errori corretti', () => {
    let s = startTyping(target)
    s = applyValue(s, 'Il rax', 0)
    s = applyValue(s, 'Il ra', 500)
    s = applyValue(s, 'Il rag', 900)
    const stats = typingStats(s)
    expect(s.hits).toBe(6)
    expect(s.misses).toBe(1)
    expect(s.corrections).toBe(1)
    expect(stats.accuracy).toBeCloseTo(6 / 7)
    expect(stats.correctChars).toBe(6)
    expect(s.wrongAt).toEqual([5])
  })

  it('tiene gli errori per tasto, quello che andava premuto', () => {
    let s = startTyping('aàa')
    s = applyValue(s, 'aa', 0)
    expect(s.keyErrors).toEqual({ à: 1 })
    expect(s.keyHits).toEqual({ a: 1, à: 1 })
    expect(s.typoKeys).toEqual({})
    s = applyValue(s, 'a', 100)
    expect(s.typoKeys).toEqual({ a: 1 })
  })

  it('calcola le parole al minuto sui caratteri giusti', () => {
    let s = startTyping('x'.repeat(100))
    s = applyValue(s, 'x', 0)
    s = applyValue(s, 'x'.repeat(50), 30_000)
    expect(typingStats(s).wpm).toBe(20) // 50 caratteri = 10 parole in mezzo minuto
    expect(typingStats(s).progress).toBe(0.5)
    expect(freeWpm(s)).toBe(20)
  })

  it('finisce al termine del testo e non va oltre', () => {
    let s = startTyping('abc')
    s = applyValue(s, 'abcdef', 0)
    expect(s.typed).toBe('abc')
    expect(typingStats(s)).toMatchObject({ done: true, exact: true, accuracy: 1 })
  })

  it('normalizza apostrofi e puntini della tastiera dell’iPad', () => {
    expect(normalizeTyped('l’energia… “x”')).toBe('l\'energia... "x"')
    let s = startTyping("l'atomo")
    s = applyValue(s, 'l’atomo', 0)
    expect(typingStats(s).exact).toBe(true)
  })

  it('regge le sostituzioni dell’autocorrezione', () => {
    let s = startTyping('di Bohr')
    s = applyValue(s, 'di Boh', 0)
    s = applyValue(s, 'di Bohr', 100)
    s = applyValue(s, 'di Bhr', 200) // cancellazione in mezzo
    expect(s.typed).toBe('di Bhr')
    expect(s.corrections).toBe(3)
  })
})

describe('Completa: chiave a trattini', () => {
  it('nasconde tutte le occorrenze della chiave', () => {
    const text = 'la parità è (-1)^l, cioè (-1)^l.'
    const ranges = keyRanges(text, '(-1)^l')
    expect(ranges).toEqual([
      [12, 18],
      [25, 31],
    ])
    expect(maskText(text, ranges)).toBe('la parità è ––––––, cioè ––––––.')
    expect(inRanges(12, ranges) && !inRanges(18, ranges)).toBe(true)
  })

  it('lascia gli spazi per contare le parole e regge la chiave vuota', () => {
    expect(maskText('a b c d', keyRanges('a b c d', 'b c'))).toBe('a – – d')
    expect(keyRanges('testo', '')).toEqual([])
  })

  it('trova la chiave in tutte le schede', () => {
    for (const s of content.schede) expect(keyRanges(s.testo, s.chiave).length).toBeGreaterThan(0)
  })
})

describe('confronto a memoria', () => {
  it('ignora maiuscole e punteggiatura ai bordi', () => {
    expect(tokenize('Il raggio, (circa) 0,529!').map((t) => t.norm)).toEqual(['il', 'raggio', 'circa', '0,529'])
  })

  it('misura la somiglianza come distanza di edit normalizzata sulle parole', () => {
    expect(similarity('a b c d', 'a b c d')).toBe(1)
    expect(similarity('a b c d', 'a x c d')).toBe(0.75)
    expect(similarity('a b c d', 'a b c')).toBe(0.75)
    expect(similarity('a b', '')).toBe(0)
    expect(similarity('', '')).toBe(1)
  })

  it('allinea parola per parola', () => {
    const { ops } = alignWords('il gas è degenere', 'il gas molto degenre')
    expect(ops.map((o) => o.op)).toEqual(['equal', 'equal', 'sub', 'sub'])
    const more = alignWords('a b c', 'a b x c')
    expect(more.ops.map((o) => o.op)).toEqual(['equal', 'equal', 'ins', 'equal'])
    expect(more.similarity).toBe(0.75)
    expect(alignWords('a b c', 'a c').ops.map((o) => o.op)).toEqual(['equal', 'del', 'equal'])
  })
})

describe('scatole di Leitner', () => {
  const today = '2026-10-28'
  const state = (box: CardState['box'], due: string): CardState => ({ id: 'c', box, due, firstReviewed: '2026-10-01', lastReviewed: '2026-10-20', updatedAt: 1 })

  it('sceglie la modalità dalla scatola', () => {
    expect([undefined, 1, 2, 3, 4, 5].map((b) => modeForBox(b as CardState['box']))).toEqual(['copia', 'copia', 'completa', 'nome', 'memoria', 'memoria'])
  })

  it('una scheda nuova riuscita va nella scatola 2, tra 2 giorni', () => {
    const r = applyReview(undefined, 'c', true, today)
    expect(r.state).toMatchObject({ box: 2, due: '2026-10-30', firstReviewed: today, lastReviewed: today })
    expect(r.early).toBe(false)
  })

  it('sale di una scatola con gli intervalli 1, 2, 4, 8, 16', () => {
    expect(applyReview(state(2, today), 'c', true, today).state).toMatchObject({ box: 3, due: '2026-11-01' })
    expect(applyReview(state(3, today), 'c', true, today).state).toMatchObject({ box: 4, due: '2026-11-05' })
    expect(applyReview(state(4, '2026-10-20'), 'c', true, today).state).toMatchObject({ box: 5, due: '2026-11-13' })
    expect(applyReview(state(5, today), 'c', true, today).state).toMatchObject({ box: 5, due: '2026-11-13' })
  })

  it('un errore riporta alla scatola 1, da rivedere domani', () => {
    const r = applyReview(state(4, today), 'c', false, today)
    expect(r.state).toMatchObject({ box: 1, due: '2026-10-29', firstReviewed: '2026-10-01' })
  })

  it('in anticipo non cambia scatola', () => {
    const r = applyReview(state(3, '2026-11-02'), 'c', false, today)
    expect(r).toMatchObject({ early: true, changed: false, boxAfter: 3 })
    expect(r.state.due).toBe('2026-11-02')
  })

  it('usa le soglie della SPEC: 97% di precisione, 85% di somiglianza', () => {
    expect(suggestedOutcome('copia', 0.97)).toBe(true)
    expect(suggestedOutcome('completa', 0.969)).toBe(false)
    expect(suggestedOutcome('memoria', 0.85)).toBe(true)
    expect(suggestedOutcome('nome', 0.84)).toBe(false)
  })
})
