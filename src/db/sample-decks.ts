// Mazzi d'esempio: le schede del file incluso, da collegare a un corso dell'utente.
// I nomi e gli id dei mazzi stanno solo nel JSON, mai nel codice.

import { AppError } from '../i18n/errors'
import { bestMatch } from '../lib/match'
import { importCards, parseContentFile, type CardImportResult, type ContentFile } from './cards-io'
import type { OrbitaDB } from './db'
import { patch } from './repo'

export interface SampleDeck {
  id: string
  name: string
  code?: string
  cards: number
}

/** Carica il JSON incluso (un pezzo a parte, in cache per l'offline) e lo controlla. */
export async function loadSampleFile(): Promise<ContentFile> {
  const module = await import('../../content/schede-2026-27.json')
  return parseContentFile(module.default)
}

export function listSampleDecks(file: ContentFile): SampleDeck[] {
  const counts = new Map<string, number>()
  for (const s of file.schede) counts.set(s.corso, (counts.get(s.corso) ?? 0) + 1)
  return file.corsi.map((c) => ({ id: c.id, name: c.nome, ...(c.codice ? { code: c.codice } : {}), cards: counts.get(c.id) ?? 0 }))
}

/** Per ogni esame il mazzo più simile (un mazzo per esame al massimo); si chiede sempre conferma. */
export function matchSampleDecks(
  file: ContentFile,
  exams: { key: string; name: string; code?: string }[],
): { deckId: string; examKey: string; score: number }[] {
  const decks = listSampleDecks(file)
  const pairs = exams
    .map((e) => {
      const m = bestMatch(e.name, decks.map((d) => ({ id: d.id, name: d.name, code: d.code })), { code: e.code })
      return m ? { deckId: m.id, examKey: e.key, score: m.score } : null
    })
    .filter((p): p is { deckId: string; examKey: string; score: number } => !!p)
    .sort((a, b) => b.score - a.score)
  // Un mazzo va a un solo esame: il più simile.
  const taken = new Set<string>()
  return pairs.filter((p) => !taken.has(p.deckId) && !!taken.add(p.deckId))
}

/** Un ContentFile senza corsi e con le sole schede del mazzo, riferite al corso scelto. */
export function sampleDeckFile(file: ContentFile, deckId: string, targetCourseId: string): ContentFile {
  return {
    ...file,
    corsi: [],
    schede: file.schede.filter((s) => s.corso === deckId).map((s) => ({ ...s, corso: targetCourseId })),
  }
}

export async function importSampleDeck(db: OrbitaDB, file: ContentFile, deckId: string, targetCourseId: string): Promise<CardImportResult> {
  const course = await db.courses.get(targetCourseId)
  if (!course || course.deletedAt) throw new AppError('courseMissing')
  const result = await importCards(db, sampleDeckFile(file, deckId, targetCourseId))
  const sections = file.corsi.find((c) => c.id === deckId)?.sezioni ?? []
  await patch(db.courses, targetCourseId, { sections: [...new Set([...course.sections, ...sections])], sampleDeck: deckId })
  return result
}
