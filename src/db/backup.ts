import { AppError } from '../i18n/errors'
import { isISODate, isMonthOnly } from '../lib/dates'
import { isRealDay, MAX_GRADE, MIN_GRADE } from '../libretto/grades'
import { isUsableDate } from '../multiverse/scenario'
import type { OrbitaDB } from './db'
import { migrateToV2, V2_INPUT_TABLES, type RawRow, type RawTables } from './migrations/v2'
import { migrateCardsV5 } from './migrations/v5'
import { TABLE_NAMES, type Syncable, type TableName } from './schema'

// Backup completo in JSON. L'importazione fonde record per record con la
// stessa regola della futura sincronizzazione: vince l'updatedAt più recente.

export const BACKUP_FORMAT = 2
/** Tabelle che, se mancano in un backup di formato 1, contano come vuote per produrre le righe derivate. */
const V1_EMPTY_OK: TableName[] = ['settings', 'rules', 'deadlines']

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
      if (name === 'results' && !validResultRow(row as unknown as Record<string, unknown>)) throw new BackupError('backupResultRow')
      if (name === 'appelli' && !validAppelloRow(row as unknown as Record<string, unknown>)) throw new BackupError('backupAppelloRow')
      if (name === 'universes' && !validUniverseRow(row as unknown as Record<string, unknown>)) throw new BackupError('backupUniverseRow')
    }
  }
  const upgraded = b.format <= 1 ? upgradeV1(b as Backup) : (b as Backup)
  // Le schede passano dalla stessa normalizzazione dell'aggiornamento alla versione 5 di Dexie.
  const cards = upgraded.tables.cards
  return cards ? { ...upgraded, tables: { ...upgraded.tables, cards: migrateCardsV5(cards as RawRow[]) as unknown as Syncable[] } } : upgraded
}

const RESULT_OUTCOMES = ['superato', 'rifiutato', 'non-superato']

/** Righe cancellate comprese: un voto non valido non entra nel database. */
function validResultRow(r: Record<string, unknown>): boolean {
  if (typeof r.courseId !== 'string') return false
  if (typeof r.date !== 'string' || !isISODate(r.date) || isMonthOnly(r.date) || !isRealDay(r.date)) return false
  if (typeof r.outcome !== 'string' || !RESULT_OUTCOMES.includes(r.outcome)) return false
  if (r.grade !== undefined && !(typeof r.grade === 'number' && Number.isInteger(r.grade) && r.grade >= MIN_GRADE && r.grade <= MAX_GRADE)) return false
  if (r.lode !== undefined && typeof r.lode !== 'boolean') return false
  return true
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validAppelloRow(r: Record<string, unknown>): boolean {
  if (typeof r.courseId !== 'string' || !r.courseId) return false
  if (!isUsableDate(r.date)) return false
  return r.note === undefined || typeof r.note === 'string'
}

function validUniverseRow(r: Record<string, unknown>): boolean {
  if (typeof r.name !== 'string') return false
  if (!isPlainObject(r.picks) || !Object.values(r.picks).every((v) => typeof v === 'string')) return false
  if (!isPlainObject(r.grades) || !Object.values(r.grades).every((v) => typeof v === 'number' && Number.isFinite(v))) return false
  return typeof r.order === 'number' && Number.isFinite(r.order)
}

/** Un backup di formato 1 passa dalla stessa trasformazione dell'aggiornamento di Dexie. */
function upgradeV1(b: Backup): Backup {
  const input: RawTables = {}
  for (const name of V2_INPUT_TABLES) {
    const rows = b.tables[name]
    if (rows) input[name] = rows as RawRow[]
    else if (V1_EMPTY_OK.includes(name)) input[name] = []
  }
  return { ...b, format: BACKUP_FORMAT, tables: { ...b.tables, ...migrateToV2(input) } as Backup['tables'] }
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
