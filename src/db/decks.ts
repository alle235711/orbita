// Mazzi da condividere: legge e scrive la tabella `decks` e fonde i mazzi ricevuti. La logica di
// decisione (cosa è nuovo, cosa si aggiorna, cosa si salta) è pura e sta in `decks/merge.ts`.

import { buildDeckFile, cleanMeta, type DeckFile, type DeckMeta } from '../decks/file'
import { planDeckMerge, targetCourseId, type DeckMergePlan, type DeckMergeStatus, type CardMergeSummary } from '../decks/merge'
import { AppError } from '../i18n/errors'
import { todayISO } from '../lib/dates'
import type { OrbitaDB } from './db'
import { alive, patch, save } from './repo'
import type { Card, Course, Deck } from './schema'

/** Una riga dell'elenco: ogni corso con schede è un mazzo; il record dei metadati può non esserci ancora. */
export interface DeckEntry {
  course: Course
  deck?: Deck
  cards: number
  sections: number
}

/** Pura: dai corsi, dai mazzi e dalle schede all'elenco, in ordine alfabetico per nome. */
export function deckEntries(courses: readonly Course[], decks: readonly Deck[], cards: readonly Card[]): DeckEntry[] {
  const byCourse = new Map<string, Card[]>()
  for (const c of cards) if (!c.deletedAt) byCourse.set(c.courseId, [...(byCourse.get(c.courseId) ?? []), c])
  const deckOf = new Map(alive([...decks]).map((d) => [d.courseId, d]))
  return courses
    .filter((c) => !c.deletedAt && byCourse.has(c.id))
    .map((course) => {
      const own = byCourse.get(course.id)!
      return { course, deck: deckOf.get(course.id), cards: own.length, sections: new Set(own.map((c) => c.section)).size }
    })
    .sort((a, b) => entryName(a).localeCompare(entryName(b), 'it') || a.course.id.localeCompare(b.course.id))
}

export const entryName = (e: Pick<DeckEntry, 'course' | 'deck'>): string => e.deck?.name || e.course.name

export async function listDeckEntries(db: OrbitaDB): Promise<DeckEntry[]> {
  const [courses, decks, cards] = await Promise.all([db.courses.toArray(), db.decks.toArray(), db.cards.toArray()])
  return deckEntries(courses, decks, cards)
}

/** I metadati proposti per un mazzo che non ne ha ancora: nome e corso dal corso locale, il resto vuoto. */
export function defaultMeta(course: Pick<Course, 'name'>, deck?: Deck): DeckMeta {
  if (deck) return { name: deck.name, author: deck.author, university: deck.university, course: deck.course, year: deck.year, license: deck.license, notes: deck.notes }
  return { name: course.name, author: '', university: '', course: course.name, year: '', license: '', notes: '' }
}

/** Salva i metadati del mazzo di un corso (lo crea se non c'è); `updatedAt` cambia solo se cambia qualcosa. */
export async function saveDeck(db: OrbitaDB, courseId: string, input: DeckMeta): Promise<Deck> {
  const meta = cleanMeta(input)
  if (!meta.name) throw new AppError('deckNeedsName')
  return db.transaction('rw', [db.decks, db.courses], async () => {
    const course = await db.courses.get(courseId)
    if (!course || course.deletedAt) throw new AppError('courseMissing')
    const current = alive(await db.decks.where('courseId').equals(courseId).toArray())[0]
    if (!current) {
      return save<Deck>(db.decks, { courseId, ...meta })
    }
    const same = (Object.keys(meta) as (keyof DeckMeta)[]).every((k) => current[k] === meta[k])
    if (same) return current
    await patch(db.decks, current.id, meta)
    return (await db.decks.get(current.id))!
  })
}

/** Il file del mazzo di un corso (le schede vive, in ordine stabile). Il mazzo deve avere il record dei metadati. */
export async function exportDeck(db: OrbitaDB, courseId: string, exportedAt: string = todayISO()): Promise<DeckFile> {
  const course = await db.courses.get(courseId)
  if (!course || course.deletedAt) throw new AppError('courseMissing')
  const deck = alive(await db.decks.where('courseId').equals(courseId).toArray())[0]
  if (!deck) throw new AppError('deckNeedsName')
  const cards = await db.cards.where('courseId').equals(courseId).toArray()
  if (!cards.some((c) => !c.deletedAt)) throw new AppError('deckNoCards')
  return buildDeckFile(deck, course, cards, exportedAt)
}

export interface DeckImportPreview {
  plan: DeckMergePlan
  courseId: string
  courseName: string
  /** Il corso che ospita il mazzo c'è già (mazzo già importato), oppure verrà creato. */
  courseExists: boolean
}

async function readState(db: OrbitaDB, file: DeckFile) {
  const localDeck = await db.decks.get(file.mazzo.id)
  const courseId = targetCourseId(file, localDeck)
  const [course, local] = await Promise.all([db.courses.get(courseId), db.cards.bulkGet(file.schede.map((s) => s.id))])
  return { localDeck, courseId, course, plan: planDeckMerge(file, localDeck, local) }
}

/** Il resoconto di cosa farebbe l'importazione, senza scrivere nulla. */
export async function previewDeckImport(db: OrbitaDB, file: DeckFile): Promise<DeckImportPreview> {
  const { courseId, course, plan } = await readState(db, file)
  const exists = !!course && !course.deletedAt
  return { plan, courseId, courseName: exists ? course.name : file.mazzo.corso || file.mazzo.nome, courseExists: exists }
}

export interface DeckImportResult {
  cards: CardMergeSummary
  deck: DeckMergeStatus
  courseId: string
  deckId: string
}

/** Fonde il mazzo nei dati locali, in una sola transazione: o tutto o niente. */
export async function importDeck(db: OrbitaDB, file: DeckFile): Promise<DeckImportResult> {
  return db.transaction('rw', [db.cards, db.courses, db.decks], async () => {
    const { courseId, course, plan } = await readState(db, file)
    const sections = [...new Set([...file.mazzo.sezioni, ...plan.rows.filter((r) => !r.deletedAt).map((r) => r.section)])]
    if (!course) {
      await save<Course>(db.courses, {
        id: courseId,
        name: file.mazzo.corso || file.mazzo.nome,
        ...(file.mazzo.codice ? { code: file.mazzo.codice } : {}),
        sections,
        difficulty: 2,
      })
    } else {
      const merged = [...new Set([...course.sections, ...sections])]
      const changes: Partial<Course> = {}
      if (merged.length !== course.sections.length) changes.sections = merged
      if (course.deletedAt) changes.deletedAt = undefined
      if (Object.keys(changes).length) await patch(db.courses, courseId, changes)
    }
    if (plan.rows.length) await db.cards.bulkPut(plan.rows)
    if (plan.deckRow) await db.decks.put(plan.deckRow)
    return { cards: plan.cards, deck: plan.deck, courseId, deckId: file.mazzo.id }
  })
}
