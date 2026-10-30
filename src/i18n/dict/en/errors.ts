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
  courseMissing: () => 'That course no longer exists.',
  backupResultRow: () => 'A grade in the backup is not valid.',
  resultInvalid: (p: { field: string; code: string }) => {
    const m: Record<string, string> = {
      'course.required': 'Choose an exam.',
      'course.invalid': 'That exam no longer exists.',
      'date.required': 'Enter the date.',
      'date.invalid': 'Enter a full date, with day, month and year.',
      'grade.invalid': 'The grade is a whole number.',
      'grade.range': 'The grade goes from 18 to 30.',
      'grade.lodeNeeds30': 'Honours only apply to a 30.',
    }
    return m[`${p.field}.${p.code}`] ?? 'Check the data you entered.'
  },
  backupAppelloRow: () => 'A sitting in the backup is not valid.',
  backupUniverseRow: () => 'A universe in the backup is not valid.',
  appelloInvalid: (p: { field: string; code: string }) => {
    const m: Record<string, string> = {
      'course.required': 'Choose the exam.',
      'course.invalid': 'That exam no longer exists.',
      'date.required': 'Enter the date or the month.',
      'date.invalid': 'The date is not valid.',
      'date.duplicate': 'This sitting already exists.',
    }
    return m[`${p.field}.${p.code}`] ?? 'Check the data you entered.'
  },
  universeLimit: () => 'At most four universes.',
  universeMin: () => 'You need at least two to compare them.',
  generic: () => 'Something went wrong.',
}
