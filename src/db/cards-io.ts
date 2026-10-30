import { AppError } from '../i18n/errors'
import { todayISO } from '../lib/dates'
import type { OrbitaDB } from './db'
import type { Card, Course } from './schema'
import { SEED_COURSES } from './seed'

// Schede di ripasso nel formato di content/schede-2026-27.json.

export interface ContentCourse {
  id: string
  nome: string
  codice?: string
  corsoDiStudio?: string
  annoAccademico?: string
  docenti?: string[]
  dataEsame?: string
  fonte?: string
  esame?: string
  testi?: string[]
  sezioni?: string[]
}

export interface ContentCard {
  id: string
  corso: string
  sezione: string
  tipo: string
  titolo: string
  testo: string
  chiave: string
  /** Facoltativo: segnata da correggere nell'app. */
  daCorreggere?: boolean
}

export interface ContentFile {
  versione: number
  aggiornato: string
  nota?: string
  corsi: ContentCourse[]
  schede: ContentCard[]
}

export class ImportError extends AppError {}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'

export function parseContentFile(json: unknown): ContentFile {
  if (!isObject(json) || !Array.isArray(json.schede)) {
    throw new ImportError('cardsNoList')
  }
  const corsi = Array.isArray(json.corsi) ? json.corsi : []
  for (const c of corsi) {
    if (!isObject(c) || !isString(c.id) || !isString(c.nome)) throw new ImportError('cardsCourseNoId')
  }
  const fields = ['id', 'corso', 'sezione', 'tipo', 'titolo', 'testo', 'chiave'] as const
  json.schede.forEach((s, i) => {
    if (!isObject(s)) throw new ImportError('cardNotObject', { n: i + 1 })
    for (const f of fields) {
      if (!isString(s[f])) {
        throw isString(s.id) ? new ImportError('cardMissingFieldById', { id: s.id, field: f }) : new ImportError('cardMissingFieldByIndex', { n: i + 1, field: f })
      }
    }
  })
  const ids = new Set<string>()
  for (const s of json.schede as ContentCard[]) {
    if (ids.has(s.id)) throw new ImportError('cardDuplicateId', { id: s.id })
    ids.add(s.id)
  }
  return {
    versione: typeof json.versione === 'number' ? json.versione : 1,
    aggiornato: isString(json.aggiornato) ? json.aggiornato : todayISO(),
    nota: isString(json.nota) ? json.nota : undefined,
    corsi: corsi as ContentCourse[],
    schede: json.schede as ContentCard[],
  }
}

export interface CardImportResult {
  added: number
  updated: number
  unchanged: number
  keptEdited: number
  courses: number
}

const sameContent = (a: Card, b: Omit<Card, 'id' | 'updatedAt' | 'needsFix' | 'userEdited'>) =>
  a.courseId === b.courseId && a.section === b.section && a.kind === b.kind && a.title === b.title && a.text === b.text && a.key === b.key

/**
 * Importa le schede: aggiunge le nuove, aggiorna quelle cambiate e lascia
 * stare quelle modificate nell'app, a meno di `overwriteEdited`.
 */
export async function importCards(
  db: OrbitaDB,
  file: ContentFile,
  { overwriteEdited = false }: { overwriteEdited?: boolean } = {},
): Promise<CardImportResult> {
  const result: CardImportResult = { added: 0, updated: 0, unchanged: 0, keptEdited: 0, courses: 0 }
  const now = Date.now()

  await db.transaction('rw', [db.cards, db.courses], async () => {
    for (const c of file.corsi) {
      const existing = await db.courses.get(c.id)
      const fromFile = {
        name: c.nome,
        code: c.codice,
        degree: c.corsoDiStudio,
        examNotes: c.esame,
        sections: c.sezioni ?? [],
      }
      if (!existing) {
        await db.courses.add({ id: c.id, ...fromFile, examDate: c.dataEsame, difficulty: 2, updatedAt: 0 })
      } else {
        // Data dell'esame e difficoltà sono tue: il file le aggiorna solo se non le hai mai toccate.
        const next: Course = { ...existing, ...fromFile, name: existing.updatedAt ? existing.name : c.nome }
        if (!existing.updatedAt && c.dataEsame) next.examDate = c.dataEsame
        await db.courses.put(next)
      }
      result.courses++
    }

    const existing = await db.cards.bulkGet(file.schede.map((s) => s.id))
    const rows: Card[] = []
    file.schede.forEach((s, i) => {
      const current = existing[i]
      const content = { courseId: s.corso, section: s.sezione, kind: s.tipo, title: s.titolo, text: s.testo, key: s.chiave }
      if (!current) {
        rows.push({ id: s.id, ...content, needsFix: !!s.daCorreggere, userEdited: false, updatedAt: 0 })
        result.added++
      } else if (current.userEdited && !current.deletedAt && !overwriteEdited) {
        result.keptEdited++
      } else if (sameContent(current, content) && !current.deletedAt) {
        result.unchanged++
      } else {
        rows.push({
          ...current,
          ...content,
          needsFix: current.needsFix || !!s.daCorreggere,
          userEdited: false,
          deletedAt: undefined,
          updatedAt: now,
        })
        result.updated++
      }
    })
    if (rows.length) await db.cards.bulkPut(rows)
  })

  return result
}

export async function exportCards(db: OrbitaDB): Promise<ContentFile> {
  const cards = (await db.cards.toArray()).filter((c) => !c.deletedAt)
  const courseIds = new Set(cards.map((c) => c.courseId))
  // I corsi nell'ordine della SPEC, quelli aggiunti dopo in coda.
  const rank = (id: string) => {
    const i = SEED_COURSES.findIndex((c) => c.id === id)
    return i < 0 ? SEED_COURSES.length : i
  }
  const courses = (await db.courses.toArray())
    .filter((c) => courseIds.has(c.id))
    .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id))
  const order = new Map(courses.map((c, i) => [c.id, i]))
  cards.sort((a, b) => (order.get(a.courseId)! - order.get(b.courseId)!) || a.id.localeCompare(b.id, 'it', { numeric: true }))

  return {
    versione: 2,
    aggiornato: todayISO(),
    nota: 'Schede esportate da Orbita. Il campo chiave è la parte del testo da nascondere nella modalità Completa.',
    corsi: courses.map((c) => ({
      id: c.id,
      nome: c.name,
      ...(c.code ? { codice: c.code } : {}),
      ...(c.degree ? { corsoDiStudio: c.degree } : {}),
      ...(c.examDate ? { dataEsame: c.examDate } : {}),
      ...(c.examNotes ? { esame: c.examNotes } : {}),
      sezioni: c.sections,
    })),
    schede: cards.map((c) => ({
      id: c.id,
      corso: c.courseId,
      sezione: c.section,
      tipo: c.kind,
      titolo: c.title,
      testo: c.text,
      chiave: c.key,
      ...(c.needsFix ? { daCorreggere: true } : {}),
    })),
  }
}
