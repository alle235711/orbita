import type { Energy } from '../../../lib/energy'
import { ENERGY } from '../../../lib/energy'
import { isMonthOnly } from '../../../lib/dates'
import type { Format } from '../../format/types'
import { capitalize } from '../../format/util'
import { legacy } from './legacy'

export const briefing = {
  /** Why that subject today. `hours` = hours spent on the priority in the last 7 days. */
  priorityReason: (p: { days: number; date: string; hours: number }, f: Format) =>
    `It’s the nearest exam: ${f.relativeDays(p.days)}, ${f.on(p.date)}.` +
    (p.hours > 0 ? ` You’ve put in ${f.hours(p.hours)} on it in the last 7 days.` : ' You haven’t worked on it yet in the last 7 days.'),

  title: 'Briefing',
  computedAt: (p: { date: string; time: string }, f: Format) =>
    `${capitalize(f.dateLong(p.date))}, calculated at ${p.time} on this device, offline.`,
  disk: (p: { energy: Energy }) => ` ${ENERGY[p.energy].name} disc.`,

  priorityLead: 'Today’s priority is',
  noPriority: 'No exam within the threshold',
  noPriorityText: 'The plan follows the nearest exam and today’s energy.',
  goToPlan: 'Go to the plan',

  toGraduation: 'Towards graduation',
  /** `end` present = period; otherwise a single date (or just a month). */
  when: (p: { date: string; end?: string; days: number }, f: Format) =>
    p.end
      ? `${f.from(p.date)} ${f.to(p.end)}`
      : isMonthOnly(p.date)
        ? f.date(p.date)
        : `${f.date(p.date)}, ${f.relativeDays(p.days)}`,

  week: 'The week',
  hoursLast7: 'Hours in the last 7 days',
  hoursOf: (p: { target: number }, f: Format) => `of ${f.hours(p.target)}`,
  hoursDeficit: (p: { deficit: number; perDay: number; tomorrow: number }, f: Format) =>
    `${f.hours(p.deficit)} behind the pace of ${f.hours(p.perDay)} a day: tomorrow’s target is ${f.hours(p.tomorrow)}.`,
  hoursOnPace: 'On pace for the week.',

  sport: 'Sport',
  sportSummary: (p: { main: 'arrampicata' | 'palestra'; runsDone: number; runsTarget: number }) =>
    `${p.main === 'arrampicata' ? 'climbing' : 'gym'}, ${p.runsDone}/${p.runsTarget} runs`,
  sportGoalsReached: 'This week’s goals reached.',

  abilityTitle: legacy.leanItem,
  abilityToday: 'Today',
  abilityNever: 'Never',
  abilityDays: (p: { n: number }) => `${p.n} d`,
  abilityDone: 'done already',
  abilitySince: 'since the last session',
  abilityWithin: 'Within the threshold.',

  englishTitle: `English with ${legacy.elsa}`,
  streak: (p: { n: number }) => `${p.n} d`,
  streakSuffix: 'in a row',
  englishDetail: (p: { minutes: number; lastScore?: number; change?: number }, f: Format) =>
    `${f.count(p.minutes, 'minute', 'minutes')} this week` +
    (p.lastScore !== undefined ? `, last score ${p.lastScore}` : '') +
    (p.change ? ` (${p.change > 0 ? '+' : ''}${p.change} in two weeks)` : '') +
    '.',

  typingTitle: 'Typing',
  wpm: 'words per minute',
  typingNone: 'No attempts yet: the first lesson sets your baseline.',
  typingRecord: (p: { best: number; daysSinceBest?: number; runs: number }, f: Format) =>
    `Record ${p.best}${p.daysSinceBest ? `, unbeaten for ${f.count(p.daysSinceBest, 'day', 'days')}` : ', just broken'}. ${f.count(p.runs, 'attempt', 'attempts')} this week.`,

  todayRules: 'Today’s rules',
  noRules: 'No rule fired today.',
  editRules: 'Edit the rules',

  tomorrow: 'Tomorrow',
  tomorrowGoal: (p: { hours: number }, f: Format) => `Target of ${f.hours(p.hours)}`,
  tomorrowPeriod: legacy.stillInPeriod,
  tomorrowNothing: 'Nothing to add for now: tomorrow’s plan is calculated in the morning.',
}
