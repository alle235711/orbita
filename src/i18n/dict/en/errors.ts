export const errors = {
  notBackup: () => 'This file isn’t an Orbita backup.',
  backupTooNew: () => 'This backup comes from a newer version of Orbita: update the app and try again.',
  backupTableNotList: (p: { name: string }) => `The ${p.name} table in the backup isn’t a list.`,
  backupRecordNoId: (p: { name: string }) => `A record in the ${p.name} table has no id or updatedAt.`,
  cardsNoList: () => 'The file has no "schede" list: it doesn’t look like an Orbita cards file.',
  cardsCourseNoId: () => 'A course in the file has no "id" and "nome".',
  cardNotObject: (p: { n: number }) => `Card number ${p.n} isn’t an object.`,
  cardMissingFieldById: (p: { id: string; field: string }) => `Card ${p.id} has no "${p.field}" field.`,
  cardMissingFieldByIndex: (p: { n: number; field: string }) => `Card number ${p.n} has no "${p.field}" field.`,
  cardDuplicateId: (p: { id: string }) => `The id ${p.id} appears twice.`,
  invalidJson: (p: { name: string }) => `${p.name} isn’t a valid JSON file.`,
  generic: () => 'Something went wrong.',
}
