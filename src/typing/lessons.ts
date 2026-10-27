// Percorso a lezioni della Dattilografia (SPEC §3.6): riga di base, riga
// superiore, riga inferiore, accenti e maiuscole, numeri e simboli, poi i
// testi delle schede. Gli esercizi mescolano sequenze sui tasti nuovi e
// parole vere delle schede che usano solo i tasti già imparati.

import { mulberry32 } from '../lib/rng'

export type LessonId = 'base' | 'superiore' | 'inferiore' | 'accenti' | 'numeri' | 'testi' | 'mirato'

export interface Lesson {
  id: LessonId
  title: string
  detail: string
  /** I tasti nuovi della lezione. */
  focus: string
  /** Tutti i caratteri ammessi, quelli delle lezioni precedenti compresi. */
  allowed: string
}

const BASE = 'asdfghjklòà'
const TOP = 'qwertyuiopè+ù'
const BOTTOM = 'zxcvbnm,.-'
const ACCENTS = 'àèéìòùAEIOUBCDFGHLMNPQRSTVZ'
const NUMBERS = "1234567890'ì!\"£$%&/()=?^;:_*"

export const LESSONS: Lesson[] = [
  { id: 'base', title: 'Riga di base', detail: 'Le dita a riposo: a s d f, j k l ò, con i rilievi su f e j.', focus: BASE, allowed: BASE },
  { id: 'superiore', title: 'Riga superiore', detail: 'Si sale di una riga senza perdere la base.', focus: TOP, allowed: BASE + TOP },
  { id: 'inferiore', title: 'Riga inferiore', detail: 'Si scende: z x c v, b n m e la punteggiatura.', focus: BOTTOM, allowed: BASE + TOP + BOTTOM },
  { id: 'accenti', title: 'Accenti e maiuscole', detail: 'Le vocali accentate e lo Shift della mano opposta.', focus: ACCENTS, allowed: BASE + TOP + BOTTOM + ACCENTS },
  { id: 'numeri', title: 'Numeri e simboli', detail: 'La riga dei numeri e i simboli col Shift, come nelle formule delle schede.', focus: NUMBERS, allowed: BASE + TOP + BOTTOM + ACCENTS + NUMBERS },
  { id: 'testi', title: 'Testi', detail: 'Le schede del ripasso, intere.', focus: '', allowed: '' },
]

export const TARGETED: Lesson = { id: 'mirato', title: 'Esercizio mirato', detail: 'Parole con i tasti dove sbagli di più.', focus: '', allowed: '' }

export const LESSON_BY_ID: Record<LessonId, Lesson> = Object.fromEntries([...LESSONS, TARGETED].map((l) => [l.id, l])) as Record<LessonId, Lesson>

/** Le parole delle schede, senza punteggiatura ai bordi, senza doppioni. */
export function corpusWords(texts: string[]): string[] {
  const words = new Set<string>()
  for (const t of texts) {
    for (const raw of t.split(/\s+/)) {
      const w = raw.replace(/^[(\["'«]+|[)\]"'»:;,.!?]+$/g, '')
      if (w.length >= 2 && w.length <= 14) words.add(w)
    }
  }
  return [...words]
}

const pick = <T>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)]!

/** Gruppi di tre o quattro tasti presi dai tasti nuovi: "fjfj dkdk sls". */
function drill(focus: string, r: () => number): string {
  const chars = [...focus]
  const len = 3 + Math.floor(r() * 2)
  const a = pick(chars, r)
  const b = pick(chars, r)
  return r() > 0.5 ? (a + b).repeat(Math.ceil(len / 2)).slice(0, len) : Array.from({ length: len }, () => pick(chars, r)).join('')
}

/**
 * Un esercizio di circa `length` caratteri per una lezione a righe: metà
 * parole vere ammesse, metà sequenze sui tasti nuovi. Stesso seme, stesso
 * esercizio.
 */
export function generateDrill(lesson: Lesson, corpus: string[], seed: number, length = 180): string {
  const r = mulberry32(seed * 7919 + lesson.id.length)
  const allowed = new Set(lesson.allowed)
  const focus = new Set(lesson.focus)
  const fits = corpus.filter((w) => [...w].every((c) => allowed.has(c)))
  const withFocus = fits.filter((w) => [...w].some((c) => focus.has(c)))
  const words: string[] = []
  let size = 0
  while (size < length) {
    const roll = r()
    const w = roll < 0.35 || !fits.length ? drill(lesson.focus, r) : roll < 0.75 && withFocus.length ? pick(withFocus, r) : pick(fits, r)
    words.push(w)
    size += w.length + 1
  }
  return words.join(' ')
}

/** Esercizio mirato: parole che contengono i tasti peggiori, più qualche sequenza. */
export function generateTargeted(keys: string[], corpus: string[], seed: number, length = 180): string {
  const r = mulberry32(seed * 104729 + keys.length)
  const chars = keys.filter((k) => k.length === 1)
  if (!chars.length) return ''
  const hits = corpus.filter((w) => [...w].some((c) => chars.includes(c.toLowerCase())))
  const words: string[] = []
  let size = 0
  while (size < length) {
    const w = r() < 0.3 || !hits.length ? drill(chars.join(''), r) : pick(hits, r)
    words.push(w)
    size += w.length + 1
  }
  return words.join(' ')
}
