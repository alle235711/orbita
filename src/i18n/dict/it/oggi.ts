import type { Format } from '../../format/types'

const cosmosOutcome = { rifiutato: 'rifiutato', 'non-superato': 'non superato' } as const

export const oggi = {
  register: 'Registra',
  energyQuestion: 'Quanto mangia il tuo buco nero oggi?',
  /** Etichetta del pianeta "adesso" sull'orbita. */
  now: 'adesso',
  orbitHeading: 'L’orbita di oggi',
  noEvents: 'Nessun impegno in agenda oggi.',
  suggestedBlocks: (p: { blocks: { start: string; title: string }[] }) =>
    `Blocchi suggeriti dal piano: ${p.blocks.map((b) => `${b.start} ${b.title}`).join(', ')}.`,
  planHeading: 'Il piano di oggi',
  openReview: 'Apri il ripasso',
  openTyping: 'Apri la dattilografia',
  stopSave: 'Ferma e salva',
  startTimer: 'Avvia il timer',
  planItemAria: (p: { title: string; duration: string; detail: string; action: string }) =>
    `${p.title}, ${p.duration}. ${p.detail} ${p.action}.`,
  running: (p: { elapsed: string }) => `In corso, ${p.elapsed}`,
  tapToStop: 'Tocca per fermare',
  cosmos: {
    title: 'Comete e lune',
    cometsTitle: 'Esami in arrivo',
    moonsTitle: 'Esami superati',
    comet: (p: { name: string; days: number; date: string }, f: Format) => `${p.name}, ${f.relativeDays(p.days)}, ${f.date(p.date)}`,
    cometMonth: (p: { name: string; date: string }, f: Format) => `${p.name}, ${f.inMonth(p.date, { year: true })}`,
    outcome: { rifiutato: 'rifiutato', 'non-superato': 'non superato' },
    periodic: (p: { name: string; outcome: 'rifiutato' | 'non-superato'; days: number; date: string }, f: Format) =>
      `${p.name}, ${cosmosOutcome[p.outcome]}; prossimo appello ${f.relativeDays(p.days)}, ${f.date(p.date)}`,
    periodicMonth: (p: { name: string; outcome: 'rifiutato' | 'non-superato'; date: string }, f: Format) =>
      `${p.name}, ${cosmosOutcome[p.outcome]}; prossimo appello ${f.inMonth(p.date, { year: true })}`,
    periodicNoDate: (p: { name: string; outcome: 'rifiutato' | 'non-superato' }) => `${p.name}, ${cosmosOutcome[p.outcome]}; prossimo appello da fissare`,
    moon: (p: { name: string; grade: number }) => `${p.name}, ${p.grade}`,
    moonLode: (p: { name: string; grade: number }) => `${p.name}, ${p.grade} e lode`,
    captured: (p: { name: string; grade: number; lode: boolean }) => `${p.name}: esame superato con ${p.grade}${p.lode ? ' e lode' : ''}`,
  },
}

