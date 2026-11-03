// Dalle schede lette ai record da scrivere. Funzioni pure.
//
// Gli id sono deterministici: stesso corso, stesso file, stesso ambiente e
// stesso progressivo danno lo stesso id. Così importare di nuovo lo stesso file
// aggiorna le schede (o le lascia com'erano) invece di duplicarle.

import type { ContentCard, ContentFile } from '../db/cards-io'
import type { TexCard, TexFileResult } from './parse'

/** Una riga dell'anteprima: la chiave identifica la scheda per le caselle di spunta. */
export interface PreviewRow {
  key: string
  /** Quante volte lo stesso nome di file è già comparso prima, più uno: serve a tenere distinti due file omonimi. */
  fileSeq: number
  card: TexCard
}

export function previewRows(results: readonly TexFileResult[]): PreviewRow[] {
  const names = new Map<string, number>()
  const rows: PreviewRow[] = []
  results.forEach((r, fileIndex) => {
    const fileSeq = (names.get(r.fileName) ?? 0) + 1
    names.set(r.fileName, fileSeq)
    for (const card of r.cards) rows.push({ key: `${fileIndex}:${card.env}:${card.number}`, fileSeq, card })
  })
  return rows
}

export function texCardId(courseId: string, row: PreviewRow): string {
  const { card, fileSeq } = row
  return `tex:${courseId}:${card.fileName}${fileSeq > 1 ? `#${fileSeq}` : ''}:${card.env}:${card.number}`
}

/** Il file di schede (come quello incluso) con le righe scelte, riferite al corso; la chiave resta vuota. */
export function texContentFile(courseId: string, rows: readonly PreviewRow[], today: string): ContentFile {
  const schede: ContentCard[] = rows.map((row) => ({
    id: texCardId(courseId, row),
    corso: courseId,
    sezione: row.card.section,
    tipo: row.card.kind,
    titolo: row.card.title,
    testo: row.card.text,
    chiave: '',
  }))
  return { versione: 2, aggiornato: today, corsi: [], schede }
}

export interface TexSummary {
  files: number
  cards: number
  errors: number
}

export function texSummary(results: readonly TexFileResult[]): TexSummary {
  return {
    files: results.length,
    cards: results.reduce((n, r) => n + r.cards.length, 0),
    errors: results.reduce((n, r) => n + r.errors.length, 0),
  }
}
