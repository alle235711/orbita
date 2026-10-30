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
  generic: () => 'Qualcosa non ha funzionato.',
}
