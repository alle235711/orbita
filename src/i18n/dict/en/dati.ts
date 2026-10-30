import type { Format } from '../../format/types'
import type { Lang } from '../../lang'

export const dati = {
  title: 'Data',
  lead: 'Everything stays on this device and works offline. Export a backup now and then.',

  courses: 'Exams',
  coursesHint:
    'If you only know the month, the exam stays upcoming until the end of the month. The theory’s difficulty decides what goes in the first hours when energy is high.',
  secondSemester: 'Second semester',
  cardsMeta: (p: { n: number }, f: Format) => f.count(p.n, 'card', 'cards'),
  exam: (p: { date: string }, f: Format) => `Exam, ${f.date(p.date, { year: true })}`,
  examTbd: 'Exam, date to be set',
  difficultyGroup: (p: { name: string }) => `Theory difficulty for ${p.name}`,
  difficulty: 'Difficulty',
  levels: { 1: 'low', 2: 'medium', 3: 'high' } as Record<1 | 2 | 3, string>,

  backup: 'Backup',
  backupNone: 'No backup yet.',
  lastBackup: (p: { days: number }, f: Format) => `Last backup ${p.days === 0 ? 'today' : f.relativeDays(-p.days)}.`,
  persistedYes: 'The browser won’t delete this data.',
  persistedNo: 'The browser may delete the data if space runs short: install Orbita on your Home screen.',
  exportAll: 'Export all data',
  importBackup: 'Import a backup',
  askPersist: 'Ask to keep it',
  mergeHint: 'Importing merges the data: for each record, the most recently edited version is kept.',
  backupSaved: 'Backup saved. Keep a copy outside this device too.',
  backupImported: (p: { added: number; updated: number; skipped: number }, f: Format) =>
    `Backup imported: ${f.count(p.added, 'new record', 'new records')}, ${p.updated} updated, ${p.skipped} already up to date.`,

  cards: 'Review cards',
  cardsCount: (p: { total: number }, f: Format) => f.count(p.total, 'card', 'cards'),
  cardsLoading: 'Loading cards',
  cardsNeedFix: (p: { n: number }) => `, ${p.n} to fix`,
  newPerDay: 'New cards per day for the most urgent subject',
  exportCards: 'Export the cards',
  importCards: 'Import cards',
  overwrite: 'Overwrite the cards I’ve edited too',
  cardsExported: (p: { n: number }, f: Format) => `Exported ${f.count(p.n, 'card', 'cards')}.`,
  cardsImported: (p: { added: number; updated: number; unchanged: number; keptEdited: number }, _f: Format) =>
    `Cards imported: ${p.added} new, ${p.updated} updated, ${p.unchanged} unchanged${p.keptEdited ? `, ${p.keptEdited} edited by you left as they are` : ''}.`,
  language: {
    title: 'Language',
    base: 'Base language',
    baseGroup: 'Base language of the interface',
    otherDays: 'Days in the other language',
    otherDaysGroup: 'Days of the week in the other language',
    otherDaysNone: 'No days chosen: the interface always stays in the base language.',
    otherDaysUsage: (p: { other: Lang }) => `On these days the interface is in ${p.other === 'en' ? 'English' : 'Italian'}.`,
    otherDaysMax: 'Three days at most: remove one to pick another.',
  },
  lessons: {
    hide: 'Hide lessons',
    aria: (p: { name: string }) => `Hide the lessons of ${p.name}`,
    hiddenNote: 'Hidden from the agenda, the cover and planning.',
  },
}
