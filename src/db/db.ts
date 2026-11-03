import { Dexie, type EntityTable } from 'dexie'
import { diffTables, migrateToV2, V2_INPUT_TABLES, type RawRow, type RawTables } from './migrations/v2'
import { normalizeCardV5 } from './migrations/v5'
import type { TableName, Tables } from './schema'

export type OrbitaDB = Dexie & { [K in TableName]: EntityTable<Tables[K], 'id'> }

// Indici: solo i campi su cui si filtra. I booleani non sono chiavi valide
// in IndexedDB, quindi `done`, `suggested` e simili non sono indicizzati.
export const SCHEMA_V1: Record<Exclude<TableName, 'results' | 'appelli' | 'universes' | 'decks'>, string> = {
  days: 'id, updatedAt',
  sessions: 'id, date, type, courseId, updatedAt',
  workouts: 'id, date, type, updatedAt',
  weights: 'id, date, updatedAt',
  events: 'id, date, updatedAt',
  tasks: 'id, due, updatedAt',
  courses: 'id, updatedAt',
  deadlines: 'id, date, updatedAt',
  cards: 'id, courseId, section, updatedAt',
  cardState: 'id, due, updatedAt',
  cardReviews: 'id, cardId, date, updatedAt',
  typingRuns: 'id, date, lesson, updatedAt',
  rules: 'id, updatedAt',
  settings: 'id, updatedAt',
}

/** Versione 3: solo la tabella dei risultati d'esame; non c'è nulla da trasformare. */
export const SCHEMA_V3_DELTA = { results: 'id, courseId, date, updatedAt' } as const

/** Versione 4: appelli e universi del Multiverso; nuove tabelle, niente da trasformare. */
export const SCHEMA_V4_DELTA = {
  appelli: 'id, courseId, date, updatedAt',
  universes: 'id, order, updatedAt',
} as const

/** Versione 6: i mazzi da condividere; nuova tabella, niente da trasformare. */
export const SCHEMA_V6_DELTA = { decks: 'id, courseId, updatedAt' } as const

export function createDb(name = 'orbita'): OrbitaDB {
  const db = new Dexie(name) as OrbitaDB
  db.version(1).stores(SCHEMA_V1)
  // La versione 2 non cambia tabelle né indici: trasforma solo i dati.
  db.version(2)
    .stores(SCHEMA_V1)
    .upgrade(async (tx) => {
      const before: RawTables = {}
      for (const name of V2_INPUT_TABLES) before[name] = (await tx.table(name).toArray()) as RawRow[]
      const changes = diffTables(before, migrateToV2(before))
      for (const name of V2_INPUT_TABLES) {
        const c = changes[name]
        if (!c) continue
        if (c.deleteIds.length) await tx.table(name).bulkDelete(c.deleteIds)
        if (c.put.length) await tx.table(name).bulkPut(c.put)
      }
    })
  db.version(3).stores(SCHEMA_V3_DELTA)
  db.version(4).stores(SCHEMA_V4_DELTA)
  // La versione 5 aggiunge alle schede il campo facoltativo formulaReading: nessun indice, solo la normalizzazione.
  db.version(5)
    .stores({})
    .upgrade(async (tx) => {
      const rows = (await tx.table('cards').toArray()) as RawRow[]
      const changed = rows.map(normalizeCardV5).filter((r, i) => r !== rows[i])
      if (changed.length) await tx.table('cards').bulkPut(changed)
    })
  // La versione 6 aggiunge solo la tabella dei mazzi: nessun dato esistente viene letto o toccato.
  db.version(6).stores(SCHEMA_V6_DELTA)
  // Una scheda rimasta aperta con la versione vecchia deve lasciare la
  // connessione, altrimenti un'altra scheda non può aggiornare il database.
  db.on('versionchange', () => {
    db.close()
    if (typeof window !== 'undefined') window.location.reload()
  })
  db.on('blocked', () => console.warn('Aggiornamento del database in attesa: chiudi le altre schede di Orbita.'))
  return db
}

export const db = createDb()
