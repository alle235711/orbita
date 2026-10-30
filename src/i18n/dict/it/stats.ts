import type { SessionType, WorkoutType } from '../../../db/schema'
import type { Period } from '../../../stats/aggregate'
import type { Format } from '../../format/types'
import { sport } from './sport'

const periods: Record<Period, string> = { '7': '7 giorni', '14': '14 giorni', anno: 'Anno accademico' }

const typeLabel: Record<SessionType, string> = {
  studio: 'Studio senza corso',
  ripasso: 'Ripasso senza corso',
  lavoro: 'Lavoro',
  abilita: 'Abilità personale',
  lingua: 'Lingua straniera',
  lettura: 'Lettura',
  dattilografia: 'Dattilografia',
}

const h = (f: Format, n: number) => `${f.number(n)} h`

export const stats = {
  title: 'Statistiche',
  period: 'Periodo',
  periods,
  typeLabel,
  rangeOne: (p: { date: string }, f: Format) => f.on(p.date, { capital: true }),
  rangeMany: (p: { from: string; to: string }, f: Format) => `${f.from(p.from, { capital: true })} ${f.to(p.to)}`,

  kpiLast7: 'Ultimi 7 giorni',
  kpiHoursOf: (p: { target: number }, f: Format) => ` h su ${f.number(p.target)}`,
  kpiAverage: 'Media al giorno nel periodo',
  hUnit: ' h',
  kpiSport: (p: { sport: WorkoutType; month: string }, f: Format) => `${sport.label[p.sport]} ${f.inMonth(p.month)}`,
  kpiSportOf: (p: { target: number }) => ` su ${p.target}`,
  kpiTyping: 'Velocità di scrittura',
  wpmShort: ' parole/min',

  hoursPerDay: 'Ore al giorno',
  hoursNote: (p: { target: number; over: number; days: number; work: boolean }, f: Format) =>
    `${p.work ? 'Studio e lavoro insieme' : 'Ore di studio'}; sopra le ${f.number(p.target)} ore in ${f.count(p.over, 'giorno', 'giorni')} su ${p.days}.`,
  lollipopTitle: (p: { date: string; total: number; study: number; work: number }, f: Format) =>
    `${f.date(p.date)}: ${h(f, p.total)}${p.work ? ` (studio ${h(f, p.study)}, lavoro ${h(f, p.work)})` : ''}`,
  colDay: 'Giorno',
  colStudy: 'Studio',
  colWork: 'Lavoro',
  colTotal: 'Totale',

  whereHours: 'Dove sono andate le ore',
  noSessions: 'Nessuna sessione nel periodo.',
  priorityNote: 'In evidenza la priorità di oggi.',
  hours: (p: { n: number }, f: Format) => h(f, p.n),

  sportTitle: 'Sport',
  workoutsCaption: 'Allenamenti',
  colType: 'Tipo',
  colSessions: 'Sessioni',
  colHours: 'Ore',

  weight: 'Peso',
  weightLast: (p: { kg: number; date: string }, f: Format) => `${f.number(p.kg)} kg ${f.on(p.date, { short: true })}`,
  weightNone: 'Nessuna pesata nel periodo',
  weightPerWeek: (p: { value: number }, f: Format) => `, ${p.value <= 0 ? '' : '+'}${f.number(p.value, 2)} kg a settimana`,
  weightPoint: (p: { date: string; kg: number }, f: Format) => `${f.dateShort(p.date)}: ${f.number(p.kg)} kg`,
  kg: (p: { v: number }, f: Format) => `${f.number(p.v)} kg`,
  weightChart: 'Andamento del peso nel periodo',
  weightFieldLabel: 'Peso di oggi in chilogrammi',
  weightPlaceholder: 'Peso di oggi, kg',
  register: 'Registra',

  energy: 'Energia e ore',
  energyNote: (p: { high: number; low: number }, f: Format) =>
    `Da Quasar e Blazar fai in media ${h(f, p.high)}, da Sgr A* e LINER ${h(f, p.low)}.`,
  energyHint: 'Scegli l’energia ogni giorno su Oggi: qui vedrai quante ore fai con ogni stato.',
  energyCaption: 'Ore medie per stato del buco nero',
  colState: 'Stato',
  colDays: 'Giorni',
  colAverage: 'Ore medie',

  typing: 'Dattilografia',
  typingRuns: (p: { n: number }, f: Format) => `${f.count(p.n, 'prova', 'prove')} nel periodo.`,
  typingNone: 'Nessuna prova nel periodo.',
  wpmTitle: 'Parole al minuto',
  accuracyTitle: 'Precisione',
  wpmPoint: (p: { date: string; wpm: number }, f: Format) => `${f.dateShort(p.date)}: ${Math.round(p.wpm)} parole al minuto`,
  accuracyPoint: (p: { date: string; accuracy: number }, f: Format) => `${f.dateShort(p.date)}: ${f.number(p.accuracy * 100, 0)}%`,
  wpmChart: 'Parole al minuto per giorno',
  accuracyChart: 'Precisione per giorno',

  languageTitle: (p: { name: string }) => p.name,
  abilityTitle: (p: { name: string }) => p.name,
  languageMinutes: (p: { n: number }, f: Format) => `${f.count(p.n, 'minuto', 'minuti')} nel periodo.`,
  minutesPerDay: 'Minuti al giorno',
  minutesPoint: (p: { date: string; n: number }, f: Format) => `${f.dateShort(p.date)}: ${f.count(p.n, 'minuto', 'minuti')}`,
  minutesFmt: (p: { v: number }) => `${Math.round(p.v)} min`,
  languageChart: (p: { name: string }) => `Minuti di ${p.name} al giorno`,
  score: 'Punteggio',
  scorePoint: (p: { date: string; score: number }, f: Format) => `${f.dateShort(p.date)}: ${p.score}`,
  scoreChart: (p: { name: string }) => `Punteggio ${p.name}`,

  watch: 'Dati dell’orologio',
  watchFuture: 'Passi, sonno e battito arriveranno in una fase successiva.',

  // grafici
  todayTick: 'oggi',
  lollipopsAria: (p: { days: number; target: number }, f: Format) => `Ore al giorno, ${f.count(p.days, 'giorno', 'giorni')}, obiettivo ${h(f, p.target)}.`,
  stripPoint: (p: { label: string; date: string }, f: Format) => `${p.label}, ${f.dateShort(p.date)}`,
  noData: 'Nessun dato nel periodo.',
  seeData: 'Vedi i dati',
}
