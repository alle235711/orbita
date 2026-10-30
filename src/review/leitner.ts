// Scatole di Leitner (SPEC §3.5): cinque scatole con intervalli di 1, 2, 4,
// 8 e 16 giorni. La scatola decide la modalità; una revisione riuscita fa
// salire di una scatola, un errore riporta alla prima.

import type { CardState, LeitnerBox, ReviewMode } from '../db/schema'
import { addDays, type ISODate } from '../lib/dates'
import { DEFAULT_TUNING, type Tuning } from '../rules/defaults'

/** Intervalli predefiniti: i valori modificabili stanno nel gruppo `ripasso`. */
export const INTERVALS: Record<LeitnerBox, number> = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 }

export function intervalsFor(tuning: Tuning = DEFAULT_TUNING): Record<LeitnerBox, number> {
  const r = tuning.ripasso
  return { 1: r.box1!, 2: r.box2!, 3: r.box3!, 4: r.box4!, 5: r.box5! }
}

/** Precisione minima in Copia e Completa, somiglianza suggerita nelle modalità a memoria. */
export const MIN_ACCURACY = 0.97
export const MIN_SIMILARITY = 0.85

export function modeForBox(box: LeitnerBox | undefined): ReviewMode {
  switch (box ?? 1) {
    case 1:
      return 'copia'
    case 2:
      return 'completa'
    case 3:
      return 'nome'
    default:
      return 'memoria'
  }
}

/** Esito suggerito: in Copia e Completa decide la precisione, a memoria la somiglianza (poi decidi tu). */
export function suggestedOutcome(mode: ReviewMode, score: number, tuning: Tuning = DEFAULT_TUNING): boolean {
  const r = tuning.ripasso
  return mode === 'copia' || mode === 'completa' ? score >= r.minAccuracy! / 100 : score >= r.minSimilarity! / 100
}

export interface ReviewOutcome {
  state: CardState
  boxAfter: LeitnerBox
  /** La scheda non era ancora scaduta: la revisione conta per le statistiche, non per la scatola. */
  early: boolean
  changed: boolean
}

export function applyReview(current: CardState | undefined, cardId: string, ok: boolean, today: ISODate, tuning: Tuning = DEFAULT_TUNING): ReviewOutcome {
  if (current && !current.deletedAt && current.due > today) {
    return { state: current, boxAfter: current.box, early: true, changed: false }
  }
  const from: LeitnerBox = current && !current.deletedAt ? current.box : 1
  const box: LeitnerBox = ok ? (Math.min(5, from + 1) as LeitnerBox) : 1
  const state: CardState = {
    id: cardId,
    box,
    due: addDays(today, intervalsFor(tuning)[box]),
    firstReviewed: current?.firstReviewed ?? today,
    lastReviewed: today,
    updatedAt: Date.now(),
  }
  return { state, boxAfter: box, early: false, changed: true }
}
