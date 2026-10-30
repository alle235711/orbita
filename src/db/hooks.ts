import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { ISODate } from '../lib/dates'
import { db } from './db'
import { alive } from './repo'
import type { Course, DayRecord, Deadline, RuleConfig } from './schema'
import { normalizeModules, normalizeStudyBlock, type ModulesSettings, type StudyBlockSettings } from '../modules/types'
import { DEFAULT_TUNING, resolveGroups, type Tuning } from '../rules/defaults'
import { normalizeProfile, type Profile } from './profile'
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

/** undefined mentre carica; null se il profilo non è mai stato salvato. */
export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => normalizeProfile(await getSetting(db, 'profile')), [])
}

export function useModules(): ModulesSettings | undefined {
  return useLiveQuery(async () => normalizeModules(await getSetting(db, 'modules')), [])
}

export function useStudyBlock(): StudyBlockSettings | undefined {
  return useLiveQuery(async () => normalizeStudyBlock(await getSetting(db, 'studyBlock')), [])
}

/** Le soglie generali in vigore: predefiniti più le righe salvate. */
export function useTuning(): Tuning {
  const rules = useRules()
  return useMemo(() => (rules.length ? resolveGroups(rules) : DEFAULT_TUNING), [rules])
}
