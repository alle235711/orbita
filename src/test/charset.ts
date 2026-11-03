// Inventario dei caratteri che si possono battere nell'app: serve ai test
// della tastiera (layout-it.test.ts) per controllare che ognuno abbia un
// tasto, un livello e un dito. Fonti:
//  - titolo, testo e chiave delle schede incluse (Copia, Completa, Indovina il nome, A memoria);
//  - la proposta del convertitore LaTeX per ogni scheda (testo e chiave);
//  - il sorgente delle formule di quelle proposte, che è quello che si batte in modalità LaTeX;
//  - le lezioni della Dattilografia.

import content from '../../content/schede-2026-27.json'
import { convertCard } from '../math/convert'
import { latexSource } from '../review/latex'
import { LESSONS } from '../typing/lessons'

export type Source = 'titolo' | 'testo' | 'chiave' | 'proposta' | 'chiave proposta' | 'sorgente LaTeX' | 'lezioni'

export interface Occurrence {
  count: number
  bySource: Partial<Record<Source, number>>
  /** Qualche scheda dove compare (id), per i caratteri rari. */
  cards: string[]
}

export function charInventory(): Map<string, Occurrence> {
  const map = new Map<string, Occurrence>()
  const add = (s: string, source: Source, card?: string) => {
    for (const ch of s) {
      const e = map.get(ch) ?? { count: 0, bySource: {}, cards: [] }
      e.count++
      e.bySource[source] = (e.bySource[source] ?? 0) + 1
      if (card && e.cards.length < 3 && !e.cards.includes(card)) e.cards.push(card)
      map.set(ch, e)
    }
  }
  for (const card of content.schede) {
    add(card.titolo, 'titolo', card.id)
    add(card.testo, 'testo', card.id)
    add(card.chiave, 'chiave', card.id)
    const proposal = convertCard({ text: card.testo, key: card.chiave })
    add(proposal.text, 'proposta', card.id)
    add(proposal.key, 'chiave proposta', card.id)
    add(latexSource(proposal.text), 'sorgente LaTeX', card.id)
  }
  for (const lesson of LESSONS) add(lesson.allowed, 'lezioni')
  return map
}
