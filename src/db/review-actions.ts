import type { ISODate } from '../lib/dates'
import { applyReview, type ReviewOutcome } from '../review/leitner'
import { resolveGroups } from '../rules/defaults'
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
  return db.transaction('rw', db.cardState, db.cardReviews, db.rules, async () => {
    const current = await db.cardState.get(cardId)
    const outcome = applyReview(current, cardId, result.ok, today, resolveGroups(await db.rules.toArray()))
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
export function updateCard(cardId: string, fields: Pick<Card, 'title' | 'text' | 'key' | 'section' | 'kind' | 'formulaReading'>): Promise<void> {
  return patch<Card>(db.cards, cardId, { ...fields, userEdited: true })
}

/** Conversioni in LaTeX confermate: nuovo testo (e chiave), e ogni scheda conta come modificata da te. */
export function applyConversions(items: { id: string; text: string; key: string }[]): Promise<void> {
  return db.transaction('rw', db.cards, async () => {
    for (const { id, text, key } of items) await patch<Card>(db.cards, id, { text, key, userEdited: true })
  })
}
