// The plan message catalogue. Keys and parameters are the `PlanMsg` contract.

import { ENERGY, type Energy } from '../../../lib/energy'
import type { WorkoutType } from '../../../db/schema'
import type { Format } from '../../format/types'
import { sport } from './sport'

type NoParams = Record<never, never>

/** "The exam is today." / "tomorrow." / "The exam is in N days." */
const examIn = (days: number) => (days === 0 ? 'The exam is today.' : days === 1 ? 'The exam is tomorrow.' : `The exam is in ${days} days.`)

const energyName = (energy: Energy) => ENERGY[energy].name

export const plan = {
  msg: {
    headlineLowA: (_p: NoParams) => 'A day',
    headlineLowB: (_p: NoParams) => 'to recharge',
    headlineMidA: (_p: NoParams) => 'A day',
    headlineMidB: (_p: NoParams) => 'for exercises',
    headlineHighA: (_p: NoParams) => 'A day',
    headlineHighB: (_p: NoParams) => 'for new theory',

    ruleLow: (p: { block: number }) => `Disc almost out: no new theory, ${p.block}-minute blocks and plenty of active review.`,
    ruleHigh: (p: { energy: Energy }) => `${p.energy === 5 ? 'Blazar' : 'Quasar'} regime: the hardest theory in the first hours, while your head can take it.`,
    ruleMidExam: (p: { block: number }) => `Steady accretion: the nearest exam comes first, in ${p.block}-minute blocks.`,
    ruleMid: (p: { block: number; pause: number }) => `Steady accretion: ${p.block}-minute blocks with a ${p.pause}-minute break.`,

    studyFreeTitle: (_p: NoParams) => 'Study',
    studyFreeDetail: (_p: NoParams) => 'No exams coming up: pick the subject yourself.',
    activeReviewTitle: (p: { course: string }) => `Active review of ${p.course}`,
    activeReviewDetail: (_p: NoParams) => 'Explain the main results out loud: no new theory.',
    exercisesTitle: (p: { course: string }) => `${p.course} exercises`,
    exercisesFirstDetail: (p: { days: number }) => `Exam exercises. ${examIn(p.days)}`,
    exercisesSecondDetail: (_p: NoParams) => 'One complete exercise, start to finish.',
    exercisesHighDetail: (p: { days: number }) => examIn(p.days),
    theoryTitle: (p: { course: string }) => `New ${p.course} theory`,
    theoryDetail: (_p: NoParams) => 'Rebuild the proofs without notes.',
    walkTitle: (_p: NoParams) => 'Walk',
    walkDetail: (_p: NoParams) => 'Active recovery, sport can wait.',
    readingTitle: (_p: NoParams) => 'Reading',
    readingDetail: (_p: NoParams) => 'One chapter, no phone.',

    sportTitle: (p: { sport: WorkoutType }) => sport.label[p.sport],
    sportMainDetail: (p: { n: number; total: number }, f: Format) => `The ${f.ordinal(p.n)} of ${f.numberWord(p.total)} this week.`,
    runDetailFirst: (_p: NoParams) => 'No runs yet this week.',
    runDetailNth: (p: { n: number }, f: Format) => `The ${f.ordinal(p.n)} run this week.`,
    sportProgress: (p: { sport: WorkoutType; done: number; target: number }) => `${sport.label[p.sport]}: ${p.done} of ${p.target}`,
    sportMissing: (p: { missing: number; byDay: number | null; inPlanToday: boolean }, f: Format) =>
      `${p.missing} to go${p.byDay === null ? ' this week' : ` by ${f.weekdayName(p.byDay)}`}${p.inPlanToday ? ': one is in today’s plan' : ''}.`,
    runsCrowded: (p: { missing: number; sport: WorkoutType }) => `${p.missing} to go: there’s already ${sport.lower[p.sport]} today, so the run goes in the coming days.`,
    runsPlanned: (p: { missing: number; minutes: number }) => `${p.missing} to go: a ${p.minutes}-minute run is in the plan.`,

    // `period` carries the Italian legacy word ("tirocinio"): not shown in English.
    periodTitle: (_p: { period: string }) => 'Internship period',
    periodText: (p: { end: string; hoursPerDay: number }, f: Format) =>
      `${f.until(p.end, { capital: true })}: target of ${f.hours(p.hoursPerDay)} a day, gym and running instead of climbing.`,

    lowTitle: (_p: NoParams) => 'No new theory',
    lowText: (p: { energy: Energy; block: number }) => `${energyName(p.energy)} disc: ${p.block}-minute blocks, active review and cards.`,
    midTitle: (_p: NoParams) => 'Nearest exam first',
    midText: (p: { energy: Energy; block: number; pause: number }) => `${energyName(p.energy)} disc: ${p.block}-minute blocks with a ${p.pause}-minute break.`,
    highTitle: (_p: NoParams) => 'Hard theory in the first hours',
    highText: (p: { energy: Energy }) => `${energyName(p.energy)} disc: the most demanding theory goes in the morning, while your head can take it.`,

    examTitle: (p: { name: string }) => `${p.name} is priority 1`,
    examText: (p: { days: number; date: string; threshold: number }, f: Format) =>
      `The exam ${p.days === 0 ? 'is today' : p.days === 1 ? 'is tomorrow' : `is in ${p.days} days`} (${f.date(p.date)}), within the threshold of ${f.count(p.threshold, 'day', 'days')}.`,

    abilityItemTitle: (p: { name: string }) => p.name,
    abilityItemDetail: (p: { days: number }, f: Format) => `Idle for ${f.count(p.days, 'day', 'days')}: exercises from the current chapter.`,
    abilityItemDetailNever: (_p: NoParams) => 'Pick up from the current chapter.',
    abilityIdleTitle: (p: { name: string; days: number }, f: Format) => `${p.name} idle for ${f.count(p.days, 'day', 'days')}`,
    abilityNeverTitle: (p: { name: string }) => `${p.name} not started yet`,
    abilityText: (p: { threshold: number; minutes: number; alsoToday: boolean }, f: Format) =>
      `Past the threshold of ${p.threshold}: ${f.count(p.minutes, 'minute', 'minutes')} in tomorrow’s plan${p.alsoToday ? ' and already in today’s' : ''}.`,

    hoursTitle: (p: { last7: number; target7: number }, f: Format) => `${f.hours(p.last7)} of ${f.hours(p.target7)} in the last 7 days`,
    hoursText: (p: { deficit: number; perDay: number; tomorrow: number }, f: Format) =>
      `${f.hours(p.deficit)} behind the pace of ${f.hours(p.perDay)} a day: tomorrow’s target rises to ${f.hours(p.tomorrow)}.`,

    cardsItemTitle: (_p: NoParams) => 'Ten-finger review',
    cardsDueDetail: (p: { due: number; course: string }, f: Format) => `${f.count(p.due, 'overdue card', 'overdue cards')}, ${p.course} first.`,
    cardsFreshDetail: (p: { fresh: number; course: string }, f: Format) => `${f.count(p.fresh, 'new card', 'new cards')} from ${p.course}.`,
    cardsNoteTitle: (p: { due: number }, f: Format) => f.count(p.due, 'overdue card', 'overdue cards'),
    cardsNoteText: (p: { minutes: number; course: string }, f: Format) => `The plan has ${f.count(p.minutes, 'minute', 'minutes')} of ten-finger review, starting with ${p.course}.`,
  },
}
