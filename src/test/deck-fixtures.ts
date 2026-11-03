// Mazzi inventati per i test della fetta J.

import type { Card, Course, Deck } from '../db/schema'

export const card = (id: string, over: Partial<Card> = {}): Card => ({
  id,
  courseId: 'c1',
  section: 'Limiti',
  kind: 'definizione',
  title: `Scheda ${id}`,
  text: `Testo della scheda ${id}, con $x_n \\to 0$.`,
  key: 'x_n',
  needsFix: false,
  userEdited: false,
  updatedAt: 100,
  ...over,
})

export const course = (over: Partial<Course> = {}): Course => ({ id: 'c1', name: 'Analisi 1', sections: ['Limiti', 'Serie'], difficulty: 2, updatedAt: 1, ...over })

export const deck = (over: Partial<Deck> = {}): Deck => ({
  id: 'deck-1',
  courseId: 'c1',
  name: 'Analisi 1, appunti',
  author: 'Ada Demo',
  university: 'Università di Prova',
  course: 'Analisi 1',
  year: '2026/2027',
  license: 'CC BY 4.0',
  notes: 'Fatto a mano.',
  updatedAt: 500,
  ...over,
})

/** Quante schede e di che lunghezza vuoi: testi diversi tra loro (altrimenti la compressione li azzera). */
export function manyCards(n: number, courseId = 'c1', words = 40): Card[] {
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff)
  return Array.from({ length: n }, (_, i) =>
    card(`k${String(i).padStart(3, '0')}`, {
      courseId,
      section: i % 2 ? 'Serie' : 'Limiti',
      title: `Teorema ${i}`,
      text: Array.from({ length: words }, () => next().toString(36)).join(' '),
    }),
  )
}
