import type { Format } from '../../format/types'

const cosmosOutcome = { rifiutato: 'refused', 'non-superato': 'failed' } as const

export const oggi = {
  register: 'Log',
  energyQuestion: 'How hungry is your black hole today?',
  /** Label of the "now" planet on the orbit. */
  now: 'now',
  orbitHeading: 'Today’s orbit',
  noEvents: 'Nothing on the agenda today.',
  suggestedBlocks: (p: { blocks: { start: string; title: string }[] }) =>
    `Blocks suggested by the plan: ${p.blocks.map((b) => `${b.start} ${b.title}`).join(', ')}.`,
  planHeading: 'Today’s plan',
  openReview: 'Open review',
  openTyping: 'Open typing',
  stopSave: 'Stop and save',
  startTimer: 'Start the timer',
  planItemAria: (p: { title: string; duration: string; detail: string; action: string }) =>
    `${p.title}, ${p.duration}. ${p.detail} ${p.action}.`,
  running: (p: { elapsed: string }) => `Running, ${p.elapsed}`,
  tapToStop: 'Tap to stop',
  cosmos: {
    title: 'Comets and moons',
    cometsTitle: 'Upcoming exams',
    moonsTitle: 'Passed exams',
    comet: (p: { name: string; days: number; date: string }, f: Format) => `${p.name}, ${f.relativeDays(p.days)}, ${f.date(p.date)}`,
    cometMonth: (p: { name: string; date: string }, f: Format) => `${p.name}, ${f.inMonth(p.date, { year: true })}`,
    outcome: { rifiutato: 'refused', 'non-superato': 'failed' },
    periodic: (p: { name: string; outcome: 'rifiutato' | 'non-superato'; days: number; date: string }, f: Format) =>
      `${p.name}, ${cosmosOutcome[p.outcome]}; next sitting ${f.relativeDays(p.days)}, ${f.date(p.date)}`,
    periodicMonth: (p: { name: string; outcome: 'rifiutato' | 'non-superato'; date: string }, f: Format) =>
      `${p.name}, ${cosmosOutcome[p.outcome]}; next sitting ${f.inMonth(p.date, { year: true })}`,
    periodicNoDate: (p: { name: string; outcome: 'rifiutato' | 'non-superato' }) => `${p.name}, ${cosmosOutcome[p.outcome]}; next sitting to be set`,
    moon: (p: { name: string; grade: number }) => `${p.name}, ${p.grade}`,
    moonLode: (p: { name: string; grade: number }) => `${p.name}, ${p.grade} with honours`,
    captured: (p: { name: string; grade: number; lode: boolean }) => `${p.name}: exam passed with ${p.grade}${p.lode ? ' with honours' : ''}`,
  },
}

