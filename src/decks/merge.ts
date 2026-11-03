// Fusione di un mazzo ricevuto con i dati locali, per id e last-write-wins su `updatedAt`, come la
// fusione dei backup. In più, per le schede: quelle modificate dall'utente (`userEdited`) non si
// sovrascrivono mai, e una scheda già in un altro corso non si sposta. Funzioni pure: leggono righe,
// restituiscono le righe da scrivere e il resoconto; la scrittura sta in `db/decks.ts`.

import type { Card, Deck } from '../db/schema'
import type { DeckCard, DeckFile } from './file'

export interface CardMergeSummary {
  added: number
  updated: number
  unchanged: number
  /** Lasciate come sono: modificate da te, più recenti qui, cancellate qui o in un altro corso. */
  skipped: number
  /** Tra le saltate: modificate dall'utente (`userEdited`). */
  keptEdited: number
  /** Tra le saltate: l'id esiste già, ma in un altro corso. */
  elsewhere: number
}

export type DeckMergeStatus = 'new' | 'updated' | 'unchanged' | 'skipped'

export interface DeckMergePlan {
  /** Righe da scrivere nella tabella delle schede (nuove e aggiornate). */
  rows: Card[]
  cards: CardMergeSummary
  deck: DeckMergeStatus
  /** Il record del mazzo da scrivere, se c'è qualcosa da scrivere. */
  deckRow?: Deck
}

/** L'id del corso creato per un mazzo importato che non ha ancora un corso: stabile, uguale su ogni dispositivo. */
export const importedCourseId = (deckId: string): string => `deck:${deckId}`

const sameContent = (local: Card, incoming: DeckCard): boolean =>
  local.section === incoming.sezione &&
  local.kind === incoming.tipo &&
  local.title === incoming.titolo &&
  local.text === incoming.testo &&
  local.key === incoming.chiave &&
  (local.formulaReading ?? '') === (incoming.letturaFormula ?? '')

/** Una scheda del file diventata riga locale (viva o cancellata), nel corso dato. */
function toRow(incoming: DeckCard, courseId: string): Card {
  return {
    id: incoming.id,
    courseId,
    section: incoming.sezione,
    kind: incoming.tipo,
    title: incoming.titolo,
    text: incoming.testo,
    key: incoming.chiave,
    needsFix: !!incoming.daCorreggere,
    userEdited: false,
    ...(incoming.letturaFormula ? { formulaReading: incoming.letturaFormula } : {}),
    ...(incoming.cancellata ? { deletedAt: incoming.cancellata } : {}),
    updatedAt: incoming.aggiornata,
  }
}

/**
 * Decide cosa fare di ogni scheda del file. `local` ha, nello stesso ordine di `incoming`, la scheda
 * locale con lo stesso id (o undefined).
 */
export function planCardMerge(
  incoming: readonly DeckCard[],
  local: readonly (Card | undefined)[],
  courseId: string,
): { rows: Card[]; summary: CardMergeSummary } {
  const summary: CardMergeSummary = { added: 0, updated: 0, unchanged: 0, skipped: 0, keptEdited: 0, elsewhere: 0 }
  const rows: Card[] = []
  incoming.forEach((card, i) => {
    const current = local[i]
    if (!current) {
      // Una scheda cancellata che qui non c'è mai stata: non c'è niente da scrivere né da togliere.
      if (card.cancellata) summary.unchanged++
      else {
        rows.push(toRow(card, courseId))
        summary.added++
      }
      return
    }
    if (current.courseId !== courseId) {
      summary.skipped++
      summary.elsewhere++
      return
    }
    if (current.userEdited && !current.deletedAt) {
      summary.skipped++
      summary.keptEdited++
      return
    }
    const newer = card.aggiornata > current.updatedAt
    if (card.cancellata) {
      if (current.deletedAt) summary.unchanged++
      else if (newer) {
        rows.push({ ...current, deletedAt: card.cancellata, updatedAt: card.aggiornata })
        summary.updated++
      } else summary.skipped++
      return
    }
    if (current.deletedAt) {
      // Cancellata qui: torna solo se la versione del file è più recente della cancellazione.
      if (newer) {
        rows.push(toRow(card, courseId))
        summary.updated++
      } else summary.skipped++
      return
    }
    if (sameContent(current, card)) summary.unchanged++
    else if (newer) {
      rows.push(toRow(card, courseId))
      summary.updated++
    } else summary.skipped++
  })
  return { rows, summary }
}

const sameMeta = (d: Deck, h: DeckFile['mazzo']): boolean =>
  d.name === h.nome && d.author === h.autore && d.university === h.ateneo && d.course === h.corso && d.year === h.anno && d.license === h.licenza && d.notes === h.note

/** Il corso che ospita le schede: quello del mazzo già presente, altrimenti uno nuovo con id stabile. */
export function targetCourseId(file: DeckFile, localDeck: Deck | undefined): string {
  return localDeck && !localDeck.deletedAt ? localDeck.courseId : importedCourseId(file.mazzo.id)
}

/** Il piano completo dell'importazione: schede, e record del mazzo (nuovo, aggiornato, uguale, saltato). */
export function planDeckMerge(file: DeckFile, localDeck: Deck | undefined, local: readonly (Card | undefined)[]): DeckMergePlan {
  const alive = localDeck && !localDeck.deletedAt ? localDeck : undefined
  const courseId = targetCourseId(file, localDeck)
  const { rows, summary } = planCardMerge(file.schede, local, courseId)
  const h = file.mazzo
  const fromFile = { name: h.nome, author: h.autore, university: h.ateneo, course: h.corso, year: h.anno, license: h.licenza, notes: h.note }
  if (!alive) {
    const deckRow: Deck = { id: h.id, courseId, ...fromFile, origin: { author: h.autore, university: h.ateneo }, updatedAt: h.aggiornato }
    return { rows, cards: summary, deck: 'new', deckRow }
  }
  if (sameMeta(alive, h)) return { rows, cards: summary, deck: 'unchanged' }
  if (h.aggiornato > alive.updatedAt) return { rows, cards: summary, deck: 'updated', deckRow: { ...alive, ...fromFile, updatedAt: h.aggiornato } }
  return { rows, cards: summary, deck: 'skipped' }
}
