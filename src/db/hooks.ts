import { useLiveQuery } from 'dexie-react-hooks'
import type { ISODate } from '../lib/dates'
import { db } from './db'
import { alive } from './repo'
import type { Course, DayRecord, Deadline, RuleConfig } from './schema'
import { getSetting, type SettingValues } from './settings'

const EMPTY: never[] = []

export function useCourses(): Course[] {
  return useLiveQuery(() => db.courses.toArray().then(alive), [], EMPTY)
}

export function useDeadlines(): Deadline[] {
  return useLiveQuery(() => db.deadlines.toArray().then(alive), [], EMPTY)
}

export function useRules(): RuleConfig[] {
  return useLiveQuery(() => db.rules.toArray().then(alive), [], EMPTY)
}

export function useDay(date: ISODate): DayRecord | undefined {
  return useLiveQuery(() => db.days.get(date).then((d) => (d && !d.deletedAt ? d : undefined)), [date])
}

export function useSetting<K extends keyof SettingValues>(key: K): SettingValues[K] | undefined {
  return useLiveQuery(() => getSetting(db, key), [key])
}
