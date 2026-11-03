// Modalità Completa: il campo `chiave` sparisce dal testo, sostituito da
// trattini. Si nascondono tutte le occorrenze, perché la seconda
// suggerirebbe la prima.
//
// Se la scheda non ha la chiave (come quelle importate da un file .tex, dove
// non si può ricavare), si nasconde l'ultima formula in display o, se non ce
// n'è, l'ultima proposizione: l'ultima frase del testo.

import { scanMath } from '../math/delimiters'

export type Range = [start: number, end: number]

export function keyRanges(text: string, key: string): Range[] {
  if (!key) return []
  const out: Range[] = []
  let from = 0
  for (;;) {
    const i = text.indexOf(key, from)
    if (i < 0) break
    out.push([i, i + key.length])
    from = i + key.length
  }
  return out
}

export function inRanges(i: number, ranges: Range[]): boolean {
  return ranges.some(([s, e]) => i >= s && i < e)
}

/** Il testo con la chiave a trattini: gli spazi restano, così si contano le parole. */
export function maskText(text: string, ranges: Range[], dash = '–'): string {
  return [...text].map((ch, i) => (inRanges(i, ranges) && ch !== ' ' ? dash : ch)).join('')
}

/** Il corpo dell'ultima formula `$$...$$` (i delimitatori restano visibili), oppure null. */
export function lastDisplayRange(text: string): Range | null {
  const spans = scanMath(text)
  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i]!
    if (s.type === 'display') return [s.bodyStart, s.bodyEnd]
  }
  return null
}

const TERMINATORS = '.;!?'

/**
 * L'ultima proposizione: dall'inizio dell'ultima frase (dopo il segno di
 * punteggiatura precedente) alla fine del testo, senza il punto finale. Un
 * segno vale solo nel testo (non dentro una formula) e se è seguito da uno
 * spazio o dalla fine: "3.14" non divide. Un testo di una frase sola si
 * nasconde per intero.
 */
export function lastSentenceRange(text: string): Range | null {
  const spans = scanMath(text)
  const isText = (i: number) => spans.some((s) => s.type === 'text' && i >= s.start && i < s.end)
  const isStop = (i: number) => TERMINATORS.includes(text[i]!) && isText(i) && (i + 1 >= text.length || /\s/.test(text[i + 1]!))

  let end = text.trimEnd().length
  while (end > 0 && isStop(end - 1)) end--
  let start = end
  while (start > 0 && !isStop(start - 1)) start--
  while (start < end && /\s/.test(text[start]!)) start++
  return start < end ? [start, end] : null
}

/** Quello che sparisce in modalità Completa: la chiave, e senza chiave l'ultima formula display o l'ultima proposizione. */
export function hiddenRanges(text: string, key: string): Range[] {
  if (key) return keyRanges(text, key)
  const fallback = lastDisplayRange(text) ?? lastSentenceRange(text)
  return fallback ? [fallback] : []
}
