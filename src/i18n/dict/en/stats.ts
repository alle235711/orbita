import type { SessionType } from '../../../db/schema'
import type { Period } from '../../../stats/aggregate'
import type { Format } from '../../format/types'
import { legacy } from './legacy'

const periods: Record<Period, string> = { '7': '7 days', '14': '14 days', settembre: 'Since September' }

const typeLabel: Record<SessionType, string> = {
  studio: 'Study without a course',
  ripasso: 'Review without a course',
  lavoro: legacy.tutoring,
  lean: legacy.leanItem,
  inglese: 'English',
  lettura: 'Reading',
  dattilografia: 'Typing',
}

const h = (f: Format, n: number) => `${f.number(n)} h`

export const stats = {
  title: 'Stats',
  period: 'Period',
  periods,
  typeLabel,
  rangeOne: (p: { date: string }, f: Format) => f.on(p.date, { capital: true }),
  rangeMany: (p: { from: string; to: string }, f: Format) => `${f.from(p.from, { capital: true })} ${f.to(p.to)}`,

  kpiLast7: 'Last 7 days',
  kpiHoursOf: (p: { target: number }, f: Format) => ` h of ${f.number(p.target)}`,
  kpiAverage: 'Daily average over the period',
  hUnit: ' h',
  kpiClimbs: (p: { month: string }, f: Format) => `Climbs ${f.inMonth(p.month)}`,
  kpiClimbsOf: (p: { target: number }) => ` of ${p.target}`,
  kpiTyping: 'Typing speed',
  wpmShort: ' wpm',

  hoursPerDay: 'Hours per day',
  hoursNote: (p: { target: number; over: number; days: number }, f: Format) =>
    `Study and work together; over ${f.number(p.target)} hours on ${f.count(p.over, 'day', 'days')} out of ${p.days}.`,
  lollipopTitle: (p: { date: string; total: number; study: number; work: number }, f: Format) =>
    `${f.date(p.date)}: ${h(f, p.total)}${p.work ? ` (study ${h(f, p.study)}, work ${h(f, p.work)})` : ''}`,
  colDay: 'Day',
  colStudy: 'Study',
  colWork: 'Work',
  colTotal: 'Total',

  whereHours: 'Where the hours went',
  noSessions: 'No sessions in this period.',
  priorityNote: 'Today’s priority is highlighted.',
  hours: (p: { n: number }, f: Format) => h(f, p.n),

  sportTitle: 'Climbing, running and gym',
  workoutsCaption: 'Workouts',
  colType: 'Type',
  colSessions: 'Sessions',
  colHours: 'Hours',

  weight: 'Weight',
  weightLast: (p: { kg: number; date: string }, f: Format) => `${f.number(p.kg)} kg ${f.on(p.date, { short: true })}`,
  weightNone: 'No weigh-ins in this period',
  weightPerWeek: (p: { value: number }, f: Format) => `, ${p.value <= 0 ? '' : '+'}${f.number(p.value, 2)} kg a week`,
  weightPoint: (p: { date: string; kg: number }, f: Format) => `${f.dateShort(p.date)}: ${f.number(p.kg)} kg`,
  kg: (p: { v: number }, f: Format) => `${f.number(p.v)} kg`,
  weightChart: 'Weight trend over the period',
  weightFieldLabel: 'Today’s weight in kilograms',
  weightPlaceholder: 'Today’s weight, kg',
  register: 'Log',

  energy: 'Energy and hours',
  energyNote: (p: { high: number; low: number }, f: Format) =>
    `On Quasar and Blazar days you average ${h(f, p.high)}, on Sgr A* and LINER days ${h(f, p.low)}.`,
  energyHint: 'Pick your energy every day on Today: here you’ll see how many hours you do in each state.',
  energyCaption: 'Average hours per black-hole state',
  colState: 'State',
  colDays: 'Days',
  colAverage: 'Average hours',

  typing: 'Typing',
  typingRuns: (p: { n: number }, f: Format) => `${f.count(p.n, 'attempt', 'attempts')} in this period.`,
  typingNone: 'No attempts in this period.',
  wpmTitle: 'Words per minute',
  accuracyTitle: 'Accuracy',
  wpmPoint: (p: { date: string; wpm: number }, f: Format) => `${f.dateShort(p.date)}: ${Math.round(p.wpm)} words per minute`,
  accuracyPoint: (p: { date: string; accuracy: number }, f: Format) => `${f.dateShort(p.date)}: ${f.number(p.accuracy * 100, 0)}%`,
  wpmChart: 'Words per minute by day',
  accuracyChart: 'Accuracy by day',

  english: `English with ${legacy.elsa}`,
  englishMinutes: (p: { n: number }, f: Format) => `${f.count(p.n, 'minute', 'minutes')} in this period.`,
  minutesPerDay: 'Minutes per day',
  minutesPoint: (p: { date: string; n: number }, f: Format) => `${f.dateShort(p.date)}: ${f.count(p.n, 'minute', 'minutes')}`,
  minutesFmt: (p: { v: number }) => `${Math.round(p.v)} min`,
  englishChart: `${legacy.elsa} minutes per day`,
  score: 'Score',
  scorePoint: (p: { date: string; score: number }, f: Format) => `${f.dateShort(p.date)}: ${p.score}`,
  scoreChart: `${legacy.elsa} score`,

  watch: 'Watch data',
  watchFuture: legacy.watchFuture,

  // charts
  todayTick: 'today',
  lollipopsAria: (p: { days: number; target: number }, f: Format) => `Hours per day, ${f.count(p.days, 'day', 'days')}, target ${h(f, p.target)}.`,
  stripPoint: (p: { label: string; date: string }, f: Format) => `${p.label}, ${f.dateShort(p.date)}`,
  noData: 'No data in this period.',
  seeData: 'See the data',
}
