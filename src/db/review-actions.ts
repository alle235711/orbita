import type { ISODate } from '../lib/dates'
import { applyReview, type ReviewOutcome } from '../review/leitner'
import { db } from './db'
import { patch, save } from './repo'
import type { Card, CardReview, ReviewMode } from './schema'

export interface ReviewResult {
  mode: ReviewMode
  wpm: number
  score: number
  wrongChars: number
  ok: boolean
}

/** Salva la revisione e aggiorna la scatola (tranne che per le revisioni in anticipo). */
export async function saveReview(cardId: string, result: ReviewResult, today: ISODate): Promise<ReviewOutcome> {
  return db.transaction('rw', db.cardState, db.cardReviews, async () => {
    const current = await db.cardState.get(cardId)
    const outcome = applyReview(current, cardId, result.ok, today)
    if (outcome.changed) await db.cardState.put(outcome.state)
    await save<CardReview>(db.cardReviews, {
      cardId,
      date: today,
      at: Date.now(),
      mode: result.mode,
      wpm: result.wpm,
      score: Math.round(result.score * 1000) / 1000,
      wrongChars: result.wrongChars,
      ok: result.ok,
      boxAfter: outcome.boxAfter,
      early: outcome.early,
    })
    return outcome
  })
}

export function setNeedsFix(cardId: string, needsFix: boolean): Promise<void> {
  return patch<Card>(db.cards, cardId, { needsFix })
}

/** Modifica nell'app: la scheda non verrà più sovrascritta dalle importazioni. */
export function updateCard(cardId: string, fields: Pick<Card, 'title' | 'text' | 'key' | 'section' | 'kind'>): Promise<void> {
  return patch<Card>(db.cards, cardId, { ...fields, userEdited: true })
}
