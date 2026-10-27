import { Dexie, type EntityTable } from 'dexie'
import type { TableName, Tables } from './schema'

export type OrbitaDB = Dexie & { [K in TableName]: EntityTable<Tables[K], 'id'> }

// Indici: solo i campi su cui si filtra. I booleani non sono chiavi valide
// in IndexedDB, quindi `done`, `suggested` e simili non sono indicizzati.
const SCHEMA_V1: Record<TableName, string> = {
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

export function createDb(name = 'orbita'): OrbitaDB {
  const db = new Dexie(name) as OrbitaDB
  db.version(1).stores(SCHEMA_V1)
  return db
}

export const db = createDb()
