// Il file di un mazzo (formato 1): un solo JSON con i metadati e le schede, pensato per girare tra
// dispositivi e per fondersi per id (last-write-wins su `aggiornata`). Chiavi in italiano come i file
// di schede. Lo stato di ripasso (scatole, scadenze) non si condivide mai.

import type { Card, Course, Deck } from '../db/schema'
import { AppError } from '../i18n/errors'

export const DECK_FORMAT = 1

export interface DeckHeader {
  id: string
  nome: string
  autore: string
  ateneo: string
  corso: string
  anno: string
  licenza: string
  note: string
  /** `updatedAt` dei metadati (ms): la versione più recente vince. */
  aggiornato: number
  codice?: string
  sezioni: string[]
}

export interface DeckCard {
  id: string
  sezione: string
  tipo: string
  titolo: string
  testo: string
  chiave: string
  /** `updatedAt` della scheda (ms). */
  aggiornata: number
  letturaFormula?: string
  daCorreggere?: boolean
  /** Scheda cancellata (cancellazione logica): `deletedAt` in ms. L'esportazione non le scrive, l'importazione le capisce. */
  cancellata?: number
}

export interface DeckFile {
  app: 'orbita'
  tipo: 'mazzo'
  versione: number
  /** Data dell'esportazione, 'YYYY-MM-DD'. */
  esportato: string
  mazzo: DeckHeader
  schede: DeckCard[]
}

/** I campi dei metadati che l'utente scrive. */
export interface DeckMeta {
  name: string
  author: string
  university: string
  course: string
  year: string
  license: string
  notes: string
}

export const META_FIELDS = ['name', 'author', 'university', 'course', 'year', 'license', 'notes'] as const satisfies readonly (keyof DeckMeta)[]

export const EMPTY_META: DeckMeta = { name: '', author: '', university: '', course: '', year: '', license: '', notes: '' }

/** Le sezioni del corso, nel suo ordine, più quelle usate dalle schede e mancanti dall'elenco. */
export function sectionsOf(course: Pick<Course, 'sections'>, cards: readonly Pick<Card, 'section'>[]): string[] {
  const used = new Set(cards.map((c) => c.section))
  const listed = course.sections.filter((s) => used.has(s))
  const extra = [...used].filter((s) => !course.sections.includes(s)).sort((a, b) => a.localeCompare(b, 'it'))
  return [...listed, ...extra]
}

/** Il file di un mazzo: schede vive del corso, in ordine stabile per id. Pura: la data arriva da fuori. */
export function buildDeckFile(deck: Deck, course: Pick<Course, 'code' | 'sections'>, cards: readonly Card[], exportedAt: string): DeckFile {
  const alive = cards.filter((c) => !c.deletedAt).sort((a, b) => a.id.localeCompare(b.id, 'it', { numeric: true }))
  return {
    app: 'orbita',
    tipo: 'mazzo',
    versione: DECK_FORMAT,
    esportato: exportedAt,
    mazzo: {
      id: deck.id,
      nome: deck.name,
      autore: deck.author,
      ateneo: deck.university,
      corso: deck.course,
      anno: deck.year,
      licenza: deck.license,
      note: deck.notes,
      aggiornato: deck.updatedAt,
      ...(course.code ? { codice: course.code } : {}),
      sezioni: sectionsOf(course, alive),
    },
    schede: alive.map((c) => ({
      id: c.id,
      sezione: c.section,
      tipo: c.kind,
      titolo: c.title,
      testo: c.text,
      chiave: c.key,
      aggiornata: c.updatedAt,
      ...(c.formulaReading ? { letturaFormula: c.formulaReading } : {}),
      ...(c.needsFix ? { daCorreggere: true } : {}),
    })),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string'
const isStamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
/** Un testo facoltativo del file: ciò che non è una stringa vale vuoto. */
const optional = (v: unknown): string => (isString(v) ? v : '')

const CARD_STRINGS = ['id', 'sezione', 'tipo', 'titolo', 'testo', 'chiave'] as const

/**
 * Controlla un file di mazzo letto da JSON. Lancia `AppError` con un codice chiaro e non scrive nulla:
 * un file sbagliato non fa perdere dati. I campi sconosciuti si ignorano, così un file di una versione
 * minore ma con campi in più si legge lo stesso; una `versione` maggiore no.
 */
export function parseDeckFile(json: unknown): DeckFile {
  if (!isObject(json) || json.app !== 'orbita' || json.tipo !== 'mazzo') throw new AppError('deckNotDeck')
  if (typeof json.versione !== 'number' || !Number.isInteger(json.versione) || json.versione < 1) throw new AppError('deckNotDeck')
  if (json.versione > DECK_FORMAT) throw new AppError('deckTooNew')
  const m = json.mazzo
  if (!isObject(m) || !isString(m.id) || !m.id || !isString(m.nome) || !m.nome.trim()) throw new AppError('deckBadHeader')
  if (!Array.isArray(json.schede)) throw new AppError('deckBadHeader')

  const ids = new Set<string>()
  const cards: DeckCard[] = json.schede.map((raw, i) => {
    if (!isObject(raw)) throw new AppError('deckCardNotObject', { n: i + 1 })
    for (const field of CARD_STRINGS) {
      if (!isString(raw[field])) {
        throw isString(raw.id) ? new AppError('deckCardFieldById', { id: raw.id, field }) : new AppError('deckCardFieldByIndex', { n: i + 1, field })
      }
    }
    const id = raw.id as string
    if (!id) throw new AppError('deckCardFieldByIndex', { n: i + 1, field: 'id' })
    if (ids.has(id)) throw new AppError('deckCardDuplicate', { id })
    ids.add(id)
    if (!isStamp(raw.aggiornata)) throw new AppError('deckCardFieldById', { id, field: 'aggiornata' })
    if (raw.cancellata !== undefined && !isStamp(raw.cancellata)) throw new AppError('deckCardFieldById', { id, field: 'cancellata' })
    return {
      id,
      sezione: raw.sezione as string,
      tipo: raw.tipo as string,
      titolo: raw.titolo as string,
      testo: raw.testo as string,
      chiave: raw.chiave as string,
      aggiornata: raw.aggiornata,
      ...(isString(raw.letturaFormula) && raw.letturaFormula.trim() ? { letturaFormula: raw.letturaFormula.trim() } : {}),
      ...(raw.daCorreggere === true ? { daCorreggere: true } : {}),
      ...(raw.cancellata !== undefined ? { cancellata: raw.cancellata as number } : {}),
    }
  })

  return {
    app: 'orbita',
    tipo: 'mazzo',
    versione: json.versione,
    esportato: optional(json.esportato),
    mazzo: {
      id: m.id,
      nome: m.nome.trim(),
      autore: optional(m.autore),
      ateneo: optional(m.ateneo),
      corso: optional(m.corso),
      anno: optional(m.anno),
      licenza: optional(m.licenza),
      note: optional(m.note),
      aggiornato: isStamp(m.aggiornato) ? m.aggiornato : 0,
      ...(isString(m.codice) && m.codice ? { codice: m.codice } : {}),
      sezioni: Array.isArray(m.sezioni) ? m.sezioni.filter(isString) : [],
    },
    schede: cards,
  }
}

/** Toglie gli spazi ai bordi dei metadati scritti dall'utente. */
export function cleanMeta(meta: DeckMeta): DeckMeta {
  const out = { ...EMPTY_META }
  for (const k of META_FIELDS) out[k] = meta[k].trim()
  return out
}
