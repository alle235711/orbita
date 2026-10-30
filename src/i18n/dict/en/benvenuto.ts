import type { Format } from '../../format/types'

// The first-run guide (and "Complete your profile").

export const benvenuto = {
  progress: 'Progress',
  stepOf: (p: { n: number; total: number }) => `${p.n} of ${p.total}`,
  announce: (p: { n: number; total: number; title: string }) => `Step ${p.n} of ${p.total}: ${p.title}`,
  back: 'Back',
  next: 'Next',
  finish: 'Done',
  close: 'Close',
  saving: 'Saving…',
  errRange: 'That value is out of range.',
  errCfuTotal: 'Enter a whole number of credits, from 1 to 600.',
  errCfuExam: 'Enter a whole number of credits, from 1 to 60.',
  errHours: 'Enter the hours per day, from 1 to 12.',

  step1: {
    titleA: 'Welcome',
    titleB: 'aboard',
    lead: 'Two things to start. Everything stays on this device and works offline too.',
    name: 'What’s your name',
    namePlaceholder: 'Optional',
    language: 'Language',
    restore: 'Restore a backup',
    restoreHint: 'Already have an Orbita backup? Pick up from there.',
    restored: (p: { added: number }, f: Format) => `Backup restored: ${f.count(p.added, 'new record', 'new records')}.`,
  },
  step2: {
    titleA: 'Your',
    titleB: 'course',
    lead: 'University and degree only help name things. You can leave them empty.',
  },
  step3: {
    titleA: 'Your',
    titleB: 'exams',
    lead: 'Add the exams waiting for you. If you don’t know the day, the month is enough.',
    exam: (p: { n: number }) => `Exam ${p.n}`,
    date: 'Date or month',
    cfuPlaceholder: 'e.g. 6',
    remove: (p: { name: string }) => `Remove ${p.name}`,
    removeUnnamed: 'Remove the row',
    add: 'Add an exam',
    empty: 'No exams for now: you can add them later from Data.',
  },
  offer: {
    title: 'Sample decks',
    lead: 'I found sample cards that look like a fit. I only import them if you choose them.',
    item: (p: { deck: string; exam: string }) => `Sample deck: “${p.deck}” for “${p.exam}”`,
    cards: (p: { n: number }, f: Format) => f.count(p.n, 'card', 'cards'),
  },
  step4: {
    titleA: 'Choose',
    titleB: 'modules',
    lead: 'Turn on what you really use. You can change them any time from Data.',
  },
  step5: {
    titleA: 'Your',
    titleB: 'day',
    lead: 'How much you usually study and how you like your study blocks.',
    hours: 'Study and work hours per day',
    preset: 'Study block',
    presetHint: (p: { preset: string }) => `When energy is low the blocks get shorter: ${p.preset}.`,
    days: 'Days in the other language',
    daysHint: 'At most three days of the week.',
  },
  complete: {
    close: 'Close without saving',
  },
}
