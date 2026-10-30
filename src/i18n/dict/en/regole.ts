import type { GroupId, RuleId } from '../../../db/schema'
import type { Format } from '../../format/types'

interface GroupText {
  title: string
  thresholds: Record<string, string>
}

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
    thresholds: { days: 'Days to the exam', warnDays: 'Warn within (days)' },
  },
  'energia-bassa': {
    title: 'Low energy',
    summary: 'Sgr A* and LINER: no new theory, short blocks, active review and cards.',
    thresholds: { maxEnergy: 'Up to level' },
  },
  'energia-media': {
    title: 'Steady energy',
    summary: 'Seyfert: the nearest exam first, long blocks with a break.',
    thresholds: {},
  },
  'energia-alta': {
    title: 'High energy',
    summary: 'Quasar and Blazar: the hardest theory in the first hours.',
    thresholds: { minEnergy: 'From level' },
  },
  sport: {
    title: 'Sport',
    summary: 'Fewer sessions of a sport type than planned by the chosen day: suggest a session. Each type’s target is set in Data.',
    thresholds: { deadline: 'By day (1 = Monday)' },
  },
  abilita: {
    title: 'Skill idle',
    summary: 'The skill has been idle for more days than the threshold: a few minutes in the next day’s plan.',
    thresholds: { days: 'Days without practice', minutes: 'Minutes to add' },
  },
  'ore-settimana': {
    title: 'Hours this week',
    summary: 'Hours in the last 7 days below target: raise tomorrow’s target.',
    thresholds: { hoursPerDay: 'Hours per day', maxHours: 'Maximum for tomorrow', warnDeficitDays: 'Warn from (days behind)' },
  },
  'schede-scadute': {
    title: 'Overdue cards',
    summary: 'Review cards are overdue: add ten-finger review.',
    thresholds: { minMinutes: 'Minimum', maxMinutes: 'Maximum', warnDue: 'Warn above (cards)' },
  },
  periodo: {
    title: 'Special period',
    summary: 'During a period with its own dates, its exceptions on hours per day and sport targets apply.',
    thresholds: {},
  },
}

const groups: Record<GroupId, GroupText> = {
  giornata: {
    title: 'The day',
    thresholds: {
      dayStart: 'Day starts at',
      dayEnd: 'Day ends at',
      eveningFrom: 'Evening starts at',
      roundStep: 'Round times to',
      secondExerciseMinutes: 'Second exercise (minutes)',
      walkMinutes: 'Walk (minutes)',
      readingMinutes: 'Reading (minutes)',
      fillerBelow: 'Add reading below N items',
    },
  },
  storico: {
    title: 'How far back to look',
    thresholds: {
      sessionsDays: 'Sessions (days)',
      workoutsDays: 'Workouts (days)',
      eventsDays: 'Events, each side (days)',
      typingDays: 'Typing runs (days)',
      scoreDays: 'Language score (days)',
    },
  },
  ripasso: {
    title: 'Review',
    thresholds: {
      box1: 'Box 1 (days)',
      box2: 'Box 2 (days)',
      box3: 'Box 3 (days)',
      box4: 'Box 4 (days)',
      box5: 'Box 5 (days)',
      minAccuracy: 'Minimum accuracy (%)',
      minSimilarity: 'Minimum similarity (%)',
    },
  },
  dattilografia: {
    title: 'Typing',
    thresholds: {
      passAccuracy: 'Accuracy to pass (%)',
      passWpm: 'Words per minute to pass',
      minSeconds: 'Minimum seconds in the speed',
      worstKeys: 'Worst keys shown',
      worstKeysMinHits: 'Minimum attempts per key',
    },
  },
  registra: {
    title: 'Log',
    thresholds: {
      studyMinutes: 'Study (minutes)',
      lavoroMinutes: 'Work (minutes)',
      abilitaMinutes: 'Skill (minutes)',
      linguaMinutes: 'Language (minutes)',
      letturaMinutes: 'Reading (minutes)',
    },
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
  periodNote: 'Period dates and exceptions are changed in ',
  datiLink: 'Data',
  rules,
  groups,
  groupsTitle: 'General thresholds',
  abilityTitle: (p: { name: string }) => `${p.name}: too long without practice`,
  periodSummaryNoSport: 'During a period with its own dates, the hours-per-day target you choose applies.',
  units: { days: 'days', min: 'min', hours: 'h' },
  range: (p: { min: number; max: number }, f: Format) => `from ${f.number(p.min)} to ${f.number(p.max)}`,
}
