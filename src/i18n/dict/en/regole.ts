import type { RuleId } from '../../../db/schema'
import type { Format } from '../../format/types'
import { legacy } from './legacy'

interface RuleText {
  title: string
  /** The rule in one line: "if … → …" */
  summary: string
  thresholds: Record<string, string>
}

const rules: Record<RuleId, RuleText> = {
  'esame-vicino': {
    title: 'Exam coming up',
    summary: 'An exam within the threshold makes that subject priority 1.',
    thresholds: { days: 'Days to the exam' },
  },
  'energia-bassa': {
    title: 'Low energy',
    summary: 'Sgr A* and LINER: no new theory, short blocks, active review and cards.',
    thresholds: { maxEnergy: 'Up to level', block: 'Block length' },
  },
  'energia-media': {
    title: 'Steady energy',
    summary: 'Seyfert: the nearest exam first, long blocks with a break.',
    thresholds: { block: 'Block length', pause: 'Break after each block' },
  },
  'energia-alta': {
    title: 'High energy',
    summary: 'Quasar and Blazar: the hardest theory in the first hours.',
    thresholds: { minEnergy: 'From level', block: 'Block length' },
  },
  sport: {
    title: 'Climbing and running',
    summary: 'Fewer climbs than planned by Thursday: suggest a session. Few runs: suggest a run.',
    thresholds: {
      climbs: 'Climbs per week',
      deadline: 'By day (1 = Monday)',
      runs: 'Runs per week',
      minutes: 'Length of a run',
    },
  },
  lean: {
    title: `${legacy.lean} idle`,
    summary: `${legacy.lean} idle for more days than the threshold: half an hour in the next day’s plan.`,
    thresholds: { days: `Days without ${legacy.lean}`, minutes: 'Minutes to add' },
  },
  'ore-settimana': {
    title: 'Hours this week',
    summary: 'Hours in the last 7 days below target: raise tomorrow’s target.',
    thresholds: { hoursPerDay: 'Hours per day', maxHours: 'Maximum for tomorrow' },
  },
  'schede-scadute': {
    title: 'Overdue cards',
    summary: 'Review cards are overdue: add ten-finger review.',
    thresholds: { minMinutes: 'Minimum', maxMinutes: 'Maximum' },
  },
  tirocinio: {
    title: legacy.periodRuleTitle,
    summary: legacy.periodRuleSummary,
    thresholds: { hoursPerDay: 'Hours per day', gym: 'Gym per week', deadline: 'By day (1 = Monday)', runs: 'Runs per week' },
  },
}

export const regole = {
  title: 'Rules',
  back: 'Briefing',
  lead: 'Today’s plan and the briefing come from these nine rules. Switch them off or change their thresholds: changes apply at once and stay on this device.',
  resetConfirm: 'Tap again to reset everything',
  reset: 'Restore the defaults',
  resetDone: 'Rules restored to their defaults.',
  on: 'On',
  off: 'Off',
  periodDatesSet: legacy.periodDatesSet,
  periodDatesMissing: legacy.periodDatesMissing,
  datiLink: 'Data',
  rules,
  units: { days: 'days', min: 'min', hours: 'h' },
  range: (p: { min: number; max: number }, f: Format) => `from ${f.number(p.min)} to ${f.number(p.max)}`,
}
