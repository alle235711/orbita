// Modalità LaTeX del ripasso (SPEC fase 3, fetta H): al posto di Completa,
// per le schede che hanno formule, si batte il sorgente delle formule.
// Funzioni pure: il confronto lavora sul sorgente, mai sull'HTML di KaTeX.

import { splitMath } from '../math/delimiters'

/**
 * Quello che si batte in modalità LaTeX: il sorgente di ogni formula della
 * scheda, in ordine, senza i delimitatori `$`, separate da uno spazio. Gli
 * spazi e gli a capo dentro una formula contano come uno spazio solo (per
 * TeX sono equivalenti, e il campo di battitura ha una riga sola).
 * Vuoto se la scheda non ha formule.
 */
export function latexSource(text: string): string {
  return splitMath(text)
    .filter((s) => s.type !== 'text')
    .map((s) => s.value.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .join(' ')
}

/** La scheda ha almeno una formula da battere. */
export function hasLatex(text: string): boolean {
  return latexSource(text) !== ''
}
