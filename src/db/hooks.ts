import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import type { ISODate } from '../lib/dates'
import { db } from './db'
import { alive } from './repo'
import type { Appello, Course, DayRecord, Deadline, ExamResult, RuleConfig, Universe } from './schema'
import { normalizeMultiverse } from '../multiverse/scenario'
import { activeCourses, normalizeGraduation, normalizeTargetAverage } from '../libretto/grades'
import { normalizeModules, normalizeStudyBlock, type ModulesSettings, type StudyBlockSettings } from '../modules/types'
import { DEFAULT_TUNING, resolveGroups, type Tuning } from '../rules/defaults'
import { normalizeProfile, type Profile } from './profile'
import { normalizePendingCaptures } from './result-actions'
import { getSetting, type GraduationSettings, type MultiverseParams, type PendingCapture, type SettingValues } from './settings'

const EMPTY: never[] = []

export function useCourses(): Course[] {
  return useLiveQuery(() => db.courses.toArray().then(alive), [], EMPTY)
}

export function useResults(): ExamResult[] {
  return useLiveQuery(() => db.results.toArray().then(alive), [], EMPTY)
}

/** Gli esami ancora da fare: quelli con un voto da superato escono. */
export function useActiveCourses(): Course[] {
  const courses = useCourses()
  const results = useResults()
  return useMemo(() => activeCourses(courses, results), [courses, results])
}

export function useGraduation(): GraduationSettings | undefined {
  return useLiveQuery(async () => normalizeGraduation(await getSetting(db, 'graduation')), [])
}

export function useTargetAverage(): number | undefined {
  return useLiveQuery(async () => normalizeTargetAverage(await getSetting(db, 'targetAverage')), [])
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

/** Voti appena presi in attesa dell'animazione di cattura; undefined mentre carica. */
export function usePendingCaptures(): PendingCapture[] | undefined {
  return useLiveQuery(async () => normalizePendingCaptures(await getSetting(db, 'pendingCaptures')), [])
}

export function useAppelli(): Appello[] {
  return useLiveQuery(() => db.appelli.toArray().then(alive), [], EMPTY)
}

/** Gli universi vivi, per `order` e poi per id. */
export function useUniverses(): Universe[] {
  return useLiveQuery(() => db.universes.toArray().then((rows) => alive(rows).sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))), [], EMPTY)
}

/** undefined mentre carica. */
export function useMultiverseParams(): MultiverseParams | undefined {
  return useLiveQuery(async () => normalizeMultiverse(await getSetting(db, 'multiverse')), [])
}
