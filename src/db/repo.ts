import type { Table } from 'dexie'
import type { Syncable } from './schema'

export const newId = (): string => crypto.randomUUID()

export const isAlive = <T extends Syncable>(row: T | undefined): row is T => !!row && !row.deletedAt

export const alive = <T extends Syncable>(rows: T[]): T[] => rows.filter((r) => !r.deletedAt)

// Le tabelle sono EntityTable<T, 'id'>: qui basta sapere che la chiave è una stringa.
type Draft<T extends Syncable> = Omit<T, 'id' | 'updatedAt'> & { id?: string }

/** Inserisce o aggiorna, timbrando `updatedAt`. */
export async function save<T extends Syncable>(table: Table<T, string, any>, draft: Draft<T>): Promise<T> {
  const row = { ...draft, id: draft.id ?? newId(), updatedAt: Date.now() } as T
  await table.put(row)
  return row
}

/** Aggiorna solo alcuni campi di un record esistente. */
export async function patch<T extends Syncable>(
  table: Table<T, string, any>,
  id: string,
  changes: Partial<Omit<T, 'id' | 'updatedAt'>>,
): Promise<void> {
  const current = await table.get(id)
  if (!current) return
  await table.put({ ...current, ...changes, id, updatedAt: Date.now() } as T)
}

/** Cancellazione logica: il record resta per la sincronizzazione. */
export async function remove<T extends Syncable>(table: Table<T, string, any>, id: string): Promise<void> {
  const current = await table.get(id)
  if (!current || current.deletedAt) return
  const now = Date.now()
  await table.put({ ...current, deletedAt: now, updatedAt: now } as T)
}
