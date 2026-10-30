import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { useMinuteClock } from '../app/useToday'
import { addDays, type ISODate } from '../lib/dates'
import { countByCourse, dailyQueue } from '../review/queue'
import { resolveGroups } from '../rules/defaults'
import { evaluate } from '../rules/plan'
import type { DayPlan, RuleContext } from '../rules/types'
import { db, type OrbitaDB } from './db'
import { alive } from './repo'
import type { CalendarEvent } from './schema'
import { normalizeModules, normalizeStudyBlock } from '../modules/types'
import { normalizeProfile } from './profile'
import { getSetting } from './settings'

export type LoadedContext = Omit<RuleContext, 'now'> & { eventsAll: CalendarEvent[] }

/** Legge dal database tutto quello che serve alle regole per il giorno `today`. */
export async function loadRuleContext(db: OrbitaDB, today: ISODate): Promise<LoadedContext> {
  const rules = await db.rules.toArray()
  const history = resolveGroups(rules).storico
  const [day, courses, deadlines, events, sessions, workouts, cards, states, newPerDay, profile, modules, studyBlock] = await Promise.all([
    db.days.get(today),
    db.courses.toArray(),
    db.deadlines.toArray(),
    db.events.where('date').between(addDays(today, -history.eventsDays!), addDays(today, history.eventsDays!), true, true).toArray(),
    db.sessions.where('date').between(addDays(today, -history.sessionsDays!), today, true, true).toArray(),
    db.workouts.where('date').between(addDays(today, -history.workoutsDays!), today, true, true).toArray(),
    db.cards.toArray(),
    db.cardState.toArray(),
    getSetting(db, 'newCardsPerDay'),
    getSetting(db, 'profile'),
    getSetting(db, 'modules'),
    getSetting(db, 'studyBlock'),
  ])
  const liveCourses = alive(courses)
  const queue = dailyQueue({ today, cards: alive(cards), states: alive(states), courses: liveCourses, newPerDay })
  const eventsAll = alive(events)
  return {
    today,
    energy: day && !day.deletedAt ? day.energy : undefined,
    courses: liveCourses,
    deadlines: alive(deadlines),
    rules: alive(rules),
    events: eventsAll.filter((e) => e.date === today),
    eventsAll,
    sessions: alive(sessions),
    workouts: alive(workouts),
    cards: { due: countByCourse(queue.due), fresh: countByCourse(queue.fresh) },
    profile: normalizeProfile(profile),
    modules: normalizeModules(modules),
    studyBlock: normalizeStudyBlock(studyBlock),
  }
}

export interface PlanState {
  context: LoadedContext
  plan: DayPlan
  now: number
}

/** Piano del giorno, ricalcolato quando cambiano i dati o passa un minuto. */
export function useDayPlan(today: ISODate): PlanState | undefined {
  const context = useLiveQuery(() => loadRuleContext(db, today), [today])
  const now = useMinuteClock()
  return useMemo(() => (context ? { context, plan: evaluate({ ...context, now }), now } : undefined), [context, now])
}
