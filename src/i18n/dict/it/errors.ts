import type { Format } from '../../format/types'

export const errors = {
  notBackup: () => 'Il file non è un backup di Orbita.',
  backupTooNew: () => 'Il backup viene da una versione di Orbita più recente: aggiorna l’app e riprova.',
  backupTableNotList: (p: { name: string }) => `La tabella ${p.name} del backup non è un elenco.`,
  backupRecordNoId: (p: { name: string }) => `Un record della tabella ${p.name} non ha id o updatedAt.`,
  cardsNoList: () => 'Il file non contiene un elenco "schede": non sembra un file di schede di Orbita.',
  cardsCourseNoId: () => 'Un corso del file non ha "id" e "nome".',
  cardNotObject: (p: { n: number }) => `La scheda numero ${p.n} non è un oggetto.`,
  cardMissingFieldById: (p: { id: string; field: string }) => `La scheda ${p.id} non ha il campo "${p.field}".`,
  cardMissingFieldByIndex: (p: { n: number; field: string }) => `La scheda numero ${p.n} non ha il campo "${p.field}".`,
  cardDuplicateId: (p: { id: string }) => `L’id ${p.id} compare due volte.`,
  invalidJson: (p: { name: string }) => `${p.name} non è un file JSON valido.`,
  courseMissing: () => 'Il corso non esiste più.',
  backupResultRow: () => 'Un voto del backup non è valido.',
  resultInvalid: (p: { field: string; code: string }) => {
    const m: Record<string, string> = {
      'course.required': 'Scegli un esame.',
      'course.invalid': 'Questo esame non c’è più.',
      'date.required': 'Inserisci la data.',
      'date.invalid': 'Scrivi una data completa, con giorno, mese e anno.',
      'grade.invalid': 'Il voto è un numero intero.',
      'grade.range': 'Il voto va da 18 a 30.',
      'grade.lodeNeeds30': 'La lode vale solo con 30.',
    }
    return m[`${p.field}.${p.code}`] ?? 'Controlla i dati inseriti.'
  },
  backupAppelloRow: () => 'Un appello del backup non è valido.',
  backupUniverseRow: () => 'Un universo del backup non è valido.',
  appelloInvalid: (p: { field: string; code: string }) => {
    const m: Record<string, string> = {
      'course.required': 'Scegli l’esame.',
      'course.invalid': 'Questo esame non c’è più.',
      'date.required': 'Inserisci la data o il mese.',
      'date.invalid': 'La data non è valida.',
      'date.duplicate': 'Questo appello c’è già.',
    }
    return m[`${p.field}.${p.code}`] ?? 'Controlla i dati inseriti.'
  },
  universeLimit: () => 'Al massimo quattro universi.',
  universeMin: () => 'Ne servono almeno due per confrontarli.',
  icsNotCalendar: () => 'Il file non è un calendario .ics.',
  icsTruncated: () => 'Il file .ics sembra incompleto: manca la fine del calendario.',
  icsNoEvents: () => 'Il calendario non contiene eventi.',
  icsNothingToImport: () => 'Nessuna lezione da importare: gli eventi sono di tutto il giorno o hanno ricorrenze non supportate.',
  icsOutsideWindow: (p: { from: string; to: string }, f: Format) =>
    `Nessuna lezione ${f.from(p.from, { year: true })} ${f.to(p.to, { year: true })}: il file è per un altro anno accademico?`,
  icsTooLarge: (p: { mb: number }) => `Il file è troppo grande per essere un orario (oltre ${p.mb} MB).`,
  icsReadFailed: (p: { name: string }) => `Non riesco a leggere ${p.name}.`,
  generic:() => 'Qualcosa non ha funzionato.',
}
