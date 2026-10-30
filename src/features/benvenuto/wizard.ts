// Il percorso guidato, nella parte pura: la bozza che si compila passo per
// passo, la validazione e il passaggio ai record da salvare. Niente React qui.

import type { OrbitaDB } from '../../db/db'
import { normalizeProfile, DEFAULT_PROFILE_FIELDS, type Profile } from '../../db/profile'
import type { Course, RuleConfig } from '../../db/schema'
import { setSetting } from '../../db/settings'
import { normalizeLanguage, MAX_OTHER_DAYS, type Lang, type LanguageSettings } from '../../i18n/lang'
import { DEFAULT_MODULES, normalizeModules, type BlockPreset, type ModulesSettings, type StudyBlockSettings } from '../../modules/types'
import { defaultThresholds } from '../../rules/defaults'

export const DEFAULT_HOURS_PER_DAY = 6
const HOURS_MIN = 1
const HOURS_MAX = 12
const CFU_EXAM_MAX = 60
const TOTAL_CFU_MAX = 600

export interface ExamDraft {
  /** Chiave stabile della riga nell'interfaccia. */
  key: string
  /** Id del corso esistente, quando si riapre il percorso. */
  id?: string
  name: string
  cfu?: number
  /** 'YYYY-MM-DD' o 'YYYY-MM' */
  date?: string
  difficulty: 1 | 2 | 3
}

export interface WizardDraft {
  name: string
  lang: Lang
  university: string
  degree: string
  totalCfu: number
  graduationTarget?: string
  exams: ExamDraft[]
  modules: ModulesSettings
  hoursPerDay: number
  preset: BlockPreset
  otherDays: number[]
  sampleDecks: { deckId: string; examKey: string }[]
}

export interface WizardExisting {
  profile: Profile | null
  courses: Course[]
  rules: RuleConfig[]
  studyBlock: StudyBlockSettings
  modules: ModulesSettings
}

export interface WizardRecords {
  profile: Profile
  modules: ModulesSettings
  studyBlock: StudyBlockSettings
  language: LanguageSettings
  /** Righe da salvare (nuove e modificate). */
  courses: Course[]
  /** Corsi che c'erano e che l'utente ha tolto dall'elenco (cancellazione logica a cura di applyDraft). */
  removedCourseIds: string[]
  /** 'ore-settimana' con le ore al giorno fuse nelle soglie esistenti. */
  rule: RuleConfig
  /** Chiave della riga della bozza → id del corso salvato: serve a collegare i mazzi d'esempio. */
  examIds: Record<string, string>
}

export function emptyDraft(lang: Lang): WizardDraft {
  return {
    name: '',
    lang,
    university: '',
    degree: '',
    totalCfu: DEFAULT_PROFILE_FIELDS.totalCfu,
    exams: [],
    modules: structuredClone(DEFAULT_MODULES),
    hoursPerDay: DEFAULT_HOURS_PER_DAY,
    preset: '50/10',
    otherDays: [],
    sampleDecks: [],
  }
}

/** La bozza che parte dai dati del database: tutti i corsi vivi, tutto precompilato. */
export function draftFromExisting(e: WizardExisting, lang: Lang, otherDays: number[]): WizardDraft {
  const p = e.profile
  const hours = e.rules.find((r) => r.id === 'ore-settimana' && !r.deletedAt)?.thresholds.hoursPerDay
  return {
    name: p?.name ?? '',
    lang,
    university: p?.university ?? '',
    degree: p?.degree ?? '',
    totalCfu: p?.totalCfu ?? DEFAULT_PROFILE_FIELDS.totalCfu,
    ...(p?.graduationTarget ? { graduationTarget: p.graduationTarget } : {}),
    exams: e.courses
      .filter((c) => !c.deletedAt)
      .map((c) => ({
        key: c.id,
        id: c.id,
        name: c.name,
        ...(c.cfu !== undefined ? { cfu: c.cfu } : {}),
        ...(c.examDate ? { date: c.examDate } : {}),
        difficulty: c.difficulty,
      })),
    modules: normalizeModules(e.modules),
    hoursPerDay: typeof hours === 'number' ? hours : DEFAULT_HOURS_PER_DAY,
    preset: e.studyBlock.preset,
    otherDays: [...otherDays],
    sampleDecks: [],
  }
}

const isInt = (n: number) => Number.isInteger(n)

/** null se il passo è valido; altrimenti id del campo → codice dell'errore. */
export function validateStep(step: 1 | 2 | 3 | 4 | 5, draft: WizardDraft): Record<string, string> | null {
  const errors: Record<string, string> = {}
  if (step === 2 && !(isInt(draft.totalCfu) && draft.totalCfu >= 1 && draft.totalCfu <= TOTAL_CFU_MAX)) errors.totalCfu = 'range'
  if (step === 3) {
    for (const exam of draft.exams) {
      if (exam.cfu !== undefined && !(isInt(exam.cfu) && exam.cfu >= 1 && exam.cfu <= CFU_EXAM_MAX)) errors[`cfu:${exam.key}`] = 'range'
    }
  }
  if (step === 5) {
    if (!(draft.hoursPerDay >= HOURS_MIN && draft.hoursPerDay <= HOURS_MAX)) errors.hoursPerDay = 'range'
    const days = draft.otherDays
    const distinct = new Set(days)
    if (days.length > MAX_OTHER_DAYS || distinct.size !== days.length || days.some((d) => !(isInt(d) && d >= 1 && d <= 7))) errors.otherDays = 'range'
  }
  return Object.keys(errors).length ? errors : null
}

const trimmed = (s: string) => s.trim()

/** I record da scrivere. Le righe con il nome vuoto si scartano; chi non è più nell'elenco finisce in `removedCourseIds`. */
export function draftToRecords(draft: WizardDraft, existing: WizardExisting, now: number, newId: () => string): WizardRecords {
  const old = new Map(existing.courses.filter((c) => !c.deletedAt).map((c) => [c.id, c]))
  const name = trimmed(draft.name)
  const university = trimmed(draft.university)
  const degree = trimmed(draft.degree)
  const profile = normalizeProfile({
    ...(name ? { name } : {}),
    ...(university ? { university } : {}),
    ...(degree ? { degree } : {}),
    totalCfu: draft.totalCfu,
    lodeValue: existing.profile?.lodeValue ?? DEFAULT_PROFILE_FIELDS.lodeValue,
    yearStart: existing.profile?.yearStart ?? DEFAULT_PROFILE_FIELDS.yearStart,
    ...(draft.graduationTarget ? { graduationTarget: draft.graduationTarget } : {}),
    completedAt: existing.profile?.completedAt ?? now,
  })!

  const courses: Course[] = []
  const examIds: Record<string, string> = {}
  const kept = new Set<string>()
  for (const exam of draft.exams) {
    const examName = trimmed(exam.name)
    if (!examName) continue
    const before = exam.id ? old.get(exam.id) : undefined
    const id = exam.id ?? newId()
    kept.add(id)
    examIds[exam.key] = id
    const { cfu: _cfu, examDate: _date, ...rest } = before ?? ({} as Course)
    courses.push({
      ...rest,
      id,
      name: examName,
      ...(exam.cfu !== undefined ? { cfu: exam.cfu } : {}),
      ...(exam.date ? { examDate: exam.date } : {}),
      difficulty: exam.difficulty,
      sections: before?.sections ?? [],
      updatedAt: now,
    })
  }
  const removedCourseIds = [...old.keys()].filter((id) => !kept.has(id))

  const current = existing.rules.find((r) => r.id === 'ore-settimana' && !r.deletedAt)
  const rule: RuleConfig = {
    id: 'ore-settimana',
    enabled: current?.enabled ?? true,
    thresholds: { ...defaultThresholds('ore-settimana'), ...current?.thresholds, hoursPerDay: draft.hoursPerDay },
    updatedAt: now,
  }

  return {
    profile,
    modules: normalizeModules(draft.modules),
    studyBlock: { ...existing.studyBlock, preset: draft.preset },
    language: normalizeLanguage({ base: draft.lang, otherDays: draft.otherDays }),
    courses,
    removedCourseIds,
    rule,
    examIds,
  }
}

/** Scrive tutto in una sola transazione: corsi, impostazioni e la regola delle ore. */
export async function applyDraft(db: OrbitaDB, records: WizardRecords): Promise<void> {
  await db.transaction('rw', db.courses, db.settings, db.rules, async () => {
    const now = Date.now()
    if (records.courses.length) await db.courses.bulkPut(records.courses)
    for (const id of records.removedCourseIds) {
      const row = await db.courses.get(id)
      if (row && !row.deletedAt) await db.courses.put({ ...row, deletedAt: now, updatedAt: now })
    }
    await db.rules.put({ ...records.rule, updatedAt: now })
    await setSetting(db, 'modules', records.modules)
    await setSetting(db, 'studyBlock', records.studyBlock)
    await setSetting(db, 'language', records.language)
    await setSetting(db, 'profile', records.profile)
  })
}
