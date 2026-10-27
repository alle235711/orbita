import { describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import type { TypingRun } from '../db/schema'
import { corpusWords, generateDrill, generateTargeted, LESSONS, LESSON_BY_ID } from './lessons'
import { isPassed, keyRates, lessonProgress, recommendedLesson, worstKeys } from './stats'

const corpus = corpusWords(content.schede.map((s) => s.testo))

const run = (lesson: string, wpm: number, accuracy: number, keyErrors: Record<string, number> = {}, keyHits: Record<string, number> = {}, at = 1): TypingRun => ({
  id: `${lesson}-${at}`,
  date: '2026-10-28',
  at,
  lesson,
  wpm,
  accuracy,
  chars: 180,
  keyErrors,
  keyHits,
  updatedAt: 1,
})

describe('lezioni', () => {
  it('seguono il percorso della SPEC', () => {
    expect(LESSONS.map((l) => l.title)).toEqual(['Riga di base', 'Riga superiore', 'Riga inferiore', 'Accenti e maiuscole', 'Numeri e simboli', 'Testi'])
  })

  it('usano solo i tasti ammessi, spazi a parte', () => {
    for (const lesson of LESSONS.filter((l) => l.allowed)) {
      for (let seed = 1; seed <= 5; seed++) {
        const text = generateDrill(lesson, corpus, seed)
        const outside = [...text].filter((c) => c !== ' ' && !lesson.allowed.includes(c))
        expect(outside, `${lesson.id} seme ${seed}`).toEqual([])
        expect(text.length).toBeGreaterThanOrEqual(170)
      }
    }
  })

  it('allenano i tasti nuovi e usano parole vere quando ci sono', () => {
    const top = LESSON_BY_ID.superiore
    const text = generateDrill(top, corpus, 3)
    expect([...text].filter((c) => top.focus.includes(c)).length).toBeGreaterThan(20)
    const words = text.split(' ')
    expect(words.some((w) => corpus.includes(w))).toBe(true)
  })

  it('sono deterministiche', () => {
    expect(generateDrill(LESSON_BY_ID.base, corpus, 4)).toBe(generateDrill(LESSON_BY_ID.base, corpus, 4))
    expect(generateDrill(LESSON_BY_ID.base, corpus, 4)).not.toBe(generateDrill(LESSON_BY_ID.base, corpus, 5))
  })

  it('l’esercizio mirato insiste sui tasti peggiori', () => {
    const text = generateTargeted(['à', 'è'], corpus, 1)
    const words = text.split(' ')
    expect(words.filter((w) => /[àè]/.test(w)).length / words.length).toBeGreaterThan(0.6)
    expect(generateTargeted([], corpus, 1)).toBe('')
  })
})

describe('statistiche', () => {
  const runs = [
    run('base', 22, 0.93, { à: 3, a: 1 }, { à: 10, a: 40, s: 30 }, 1),
    run('base', 27, 0.96, { à: 1 }, { à: 10, a: 40 }, 2),
    run('superiore', 20, 0.9, { è: 4, '+': 1 }, { è: 8, '+': 2 }, 3),
  ]

  it('somma errori e tentativi per tasto', () => {
    const rates = keyRates(runs)
    expect(rates.get('à')).toMatchObject({ errors: 4, hits: 20, rate: 0.2 })
    expect(rates.get('s')).toMatchObject({ errors: 0, hits: 30, rate: 0 })
  })

  it('trova i tasti peggiori con abbastanza tentativi', () => {
    expect(worstKeys(runs).map((r) => r.key)).toEqual(['è', 'à', 'a'])
    expect(worstKeys(runs, 5, 12).map((r) => r.key)).toEqual(['à', 'a'])
  })

  it('tiene il meglio di ogni lezione e consiglia la prossima', () => {
    const p = lessonProgress(runs)
    expect(p.base).toMatchObject({ runs: 2, bestWpm: 27, bestAccuracy: 0.96 })
    expect(isPassed(p.base)).toBe(true)
    expect(isPassed(p.superiore)).toBe(false)
    expect(recommendedLesson(runs)).toBe('superiore')
    expect(recommendedLesson([])).toBe('base')
  })
})
