// Versione 5: le schede guadagnano il campo facoltativo `formulaReading`, la
// lettura a parole delle formule (la "letturaFormula" dei file di schede).
// Nessun indice nuovo; la trasformazione è pura, deterministica e
// idempotente, e gira sia nell'aggiornamento di Dexie sia all'importazione
// di un backup, così i due percorsi danno le stesse righe:
// - un campo `letturaFormula` (scritto con il nome dei file di schede) diventa
//   `formulaReading`, se questo non c'è già;
// - `formulaReading` è una stringa senza spazi ai bordi, oppure non c'è.
// `updatedAt` non cambia: non è una modifica dell'utente.

import type { RawRow } from './v2'

/** La scheda normalizzata; se non c'è nulla da cambiare torna la stessa riga. */
export function normalizeCardV5(row: RawRow): RawRow {
  const legacy = row.letturaFormula
  const hasLegacy = 'letturaFormula' in row
  const current = 'formulaReading' in row ? row.formulaReading : legacy
  const reading = typeof current === 'string' ? current.trim() : ''
  if (!hasLegacy && (reading ? row.formulaReading === reading : !('formulaReading' in row))) return row
  const { letturaFormula: _legacy, formulaReading: _reading, ...rest } = row
  return (reading ? { ...rest, formulaReading: reading } : rest) as RawRow
}

/** Le schede della versione 5. L'ingresso non viene modificato. */
export function migrateCardsV5(rows: RawRow[]): RawRow[] {
  return rows.map(normalizeCardV5)
}
