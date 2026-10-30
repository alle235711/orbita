import { AppError } from '../i18n/errors'
import type { OrbitaDB } from './db'
import { TABLE_NAMES, type Syncable, type TableName } from './schema'

// Backup completo in JSON. L'importazione fonde record per record con la
// stessa regola della futura sincronizzazione: vince l'updatedAt più recente.

export const BACKUP_FORMAT = 1

export interface Backup {
  app: 'orbita'
  format: number
  exportedAt: string
  tables: Partial<Record<TableName, Syncable[]>>
}

export interface MergeResult {
  added: number
  updated: number
  skipped: number
}

export class BackupError extends AppError {}

export async function exportAll(db: OrbitaDB): Promise<Backup> {
  const tables: Backup['tables'] = {}
  await db.transaction('r', TABLE_NAMES.map((t) => db[t]), async () => {
    for (const name of TABLE_NAMES) tables[name] = await db[name].toArray()
  })
  return { app: 'orbita', format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), tables }
}

export function parseBackup(json: unknown): Backup {
  if (typeof json !== 'object' || json === null) throw new BackupError('notBackup')
  const b = json as Partial<Backup>
  if (b.app !== 'orbita' || typeof b.tables !== 'object' || b.tables === null) {
    throw new BackupError('notBackup')
  }
  if (typeof b.format !== 'number' || b.format > BACKUP_FORMAT) {
    throw new BackupError('backupTooNew')
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!(TABLE_NAMES as string[]).includes(name)) continue
    if (!Array.isArray(rows)) throw new BackupError('backupTableNotList', { name })
    for (const row of rows) {
      if (typeof row !== 'object' || row === null || typeof (row as Syncable).id !== 'string' || typeof (row as Syncable).updatedAt !== 'number') {
        throw new BackupError('backupRecordNoId', { name })
      }
    }
  }
  return b as Backup
}

/** Fonde il backup nei dati locali: per ogni id resta la versione più recente. */
export async function importBackup(db: OrbitaDB, backup: Backup): Promise<MergeResult> {
  const result: MergeResult = { added: 0, updated: 0, skipped: 0 }
  await db.transaction('rw', TABLE_NAMES.map((t) => db[t]), async () => {
    for (const name of TABLE_NAMES) {
      const rows = backup.tables[name]
      if (!rows?.length) continue
      const table = db[name] as unknown as {
        bulkGet(ids: string[]): Promise<(Syncable | undefined)[]>
        bulkPut(rows: Syncable[]): Promise<unknown>
      }
      const existing = await table.bulkGet(rows.map((r) => r.id))
      const winners: Syncable[] = []
      rows.forEach((row, i) => {
        const current = existing[i]
        if (!current) {
          winners.push(row)
          result.added++
        } else if (row.updatedAt > current.updatedAt) {
          winners.push(row)
          result.updated++
        } else {
          result.skipped++
        }
      })
      if (winners.length) await table.bulkPut(winners)
    }
  })
  return result
}

export function backupFileName(date: string): string {
  return `orbita-backup-${date}.json`
}
