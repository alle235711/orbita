// Importazione delle schede lette da file .tex: stessa strada delle schede incluse
// (`importCards`), così le schede modificate nell'app non si sovrascrivono e
// reimportare lo stesso file non duplica nulla. Lo stato di ripasso non si crea:
// una scheda senza stato è nuova, come per le altre schede importate.

import { AppError } from '../i18n/errors'
import { todayISO } from '../lib/dates'
import type { PreviewRow } from '../tex/plan'
import { texContentFile } from '../tex/plan'
import { importCards, type CardImportResult } from './cards-io'
import type { OrbitaDB } from './db'
import { patch } from './repo'

export async function importTexCards(db: OrbitaDB, courseId: string, rows: readonly PreviewRow[]): Promise<CardImportResult> {
  const course = await db.courses.get(courseId)
  if (!course || course.deletedAt) throw new AppError('courseMissing')
  const result = await importCards(db, texContentFile(courseId, rows, todayISO()))
  // Le sezioni nuove entrano nell'elenco del corso (una volta sola: reimportare non lo tocca).
  const missing = [...new Set(rows.map((r) => r.card.section))].filter((s) => !course.sections.includes(s))
  if (missing.length) await patch(db.courses, courseId, { sections: [...course.sections, ...missing] })
  return result
}
