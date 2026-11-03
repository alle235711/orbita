import type { Format } from '../../format/types'

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
  icsNotCalendar: () => 'This file is not an .ics calendar.',
  icsTruncated: () => 'This .ics file looks incomplete: the end of the calendar is missing.',
  icsNoEvents: () => 'The calendar has no events.',
  icsNothingToImport: () => 'No lessons to import: the events are all-day or use unsupported recurrences.',
  icsOutsideWindow: (p: { from: string; to: string }, f: Format) =>
    `No lessons ${f.from(p.from, { year: true })} ${f.to(p.to, { year: true })}: is the file for another academic year?`,
  icsTooLarge: (p: { mb: number }) => `The file is too large to be a timetable (over ${p.mb} MB).`,
  icsReadFailed: (p: { name: string }) => `I can’t read ${p.name}.`,
  texUnclosedEnv: (p: { env: string; line: number }) => `Line ${p.line}: the “${p.env}” environment is never closed, its \\end is missing. The block is not imported.`,
  texStrayEnd: (p: { env: string; line: number }) => `Line ${p.line}: there is an \\end of “${p.env}” with no matching \\begin.`,
  texMismatch: (p: { end: string; begin: string; beginLine: number; line: number }) =>
    `Line ${p.line}: the \\end of “${p.end}” does not match the \\begin of “${p.begin}” on line ${p.beginLine}. The block is not imported.`,
  texBraces: (p: { env: string; line: number }) => `Line ${p.line}: the braces in the “${p.env}” block are not balanced. The block is not imported.`,
  texBadTitle: (p: { env: string; line: number }) => `Line ${p.line}: the title in square brackets of the “${p.env}” block is never closed. The block is not imported.`,
  texUnknownEnv: (p: { env: string; line: number }) =>
    `Line ${p.line}: the “${p.env}” environment is not one of those to import. If it is a card, add it to the list of other environments.`,
  texBadNewtheorem: (p: { line: number }) => `Line ${p.line}: this \\newtheorem is not written in a form I can read.`,
  texBadHeading: (p: { line: number }) => `Line ${p.line}: the title of this section cannot be read (missing braces?). The section is skipped.`,
  texEmpty: (p: { env: string; line: number }) => `Line ${p.line}: the “${p.env}” block is empty.`,
  texInternal: () => 'This file cannot be read: no card is imported from it.',
  texReadFailed: (p: { name: string }) => `I can’t read ${p.name}.`,
  texTooLarge: (p: { mb: number }) => `The file is too large to be a .tex file (over ${p.mb} MB).`,
  generic:() => 'Something went wrong.',
}
