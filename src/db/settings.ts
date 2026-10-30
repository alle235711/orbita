import { DEFAULT_LANGUAGE, type LanguageSettings } from '../i18n/lang'
import { DEFAULT_MODULES, DEFAULT_STUDY_BLOCK, type ModulesSettings, type StudyBlockSettings } from '../modules/types'
import { DEFAULT_GRADUATION, type GraduationFormula } from '../libretto/grades'
import type { OrbitaDB } from './db'
import type { Profile } from './profile'

export interface ActiveTimer {
  /** Chiave della voce del piano avviata. */
  key: string
  title: string
  kind: 'session' | 'workout'
  type: string
  courseId?: string
  startedAt: number
  /** Minuti del blocco di studio previsto (voci di studio del piano). */
  planned?: number
}

export interface PendingCapture {
  resultId: string
  courseId: string
}
export interface GraduationSettings {
  formula: GraduationFormula
}

/** Soglie del Multiverso. Passare da normalizeMultiverse (src/multiverse/scenario.ts). */
export interface MultiverseParams {
  /** Due esami a meno di (o esattamente) questi giorni l'uno dall'altro sono troppo vicini. */
  closeDays: number
  /** Giorni tra l'ultimo esame e la laurea possibile. */
  finalGapDays: number
}
export const DEFAULT_MULTIVERSE: MultiverseParams = { closeDays: 5, finalGapDays: 60 }

/** Le impostazioni conosciute, con il loro tipo e il valore predefinito. */
export interface SettingValues {
  newCardsPerDay: number
  targetAverage: number
  lastBackupAt: number | null
  activeTimer: ActiveTimer | null
  /** Passare sempre da normalizeLanguage in lettura e scrittura. */
  language: LanguageSettings
  /** null = mai configurato. Passare da normalizeProfile. */
  profile: Profile | null
  /** Passare da normalizeModules. */
  modules: ModulesSettings
  /** Passare da normalizeStudyBlock. */
  studyBlock: StudyBlockSettings
  /** Passare da normalizeGraduation. */
  graduation: GraduationSettings
  /** Voti appena presi in attesa dell'animazione di cattura. Passare da normalizePendingCaptures. */
  pendingCaptures: PendingCapture[]
  multiverse: MultiverseParams
}

export const SETTING_DEFAULTS: SettingValues = {
  newCardsPerDay: 15,
  targetAverage: 28,
  lastBackupAt: null,
  activeTimer: null,
  language: DEFAULT_LANGUAGE,
  profile: null,
  modules: DEFAULT_MODULES,
  studyBlock: DEFAULT_STUDY_BLOCK,
  graduation: DEFAULT_GRADUATION,
  pendingCaptures: [],
  multiverse: DEFAULT_MULTIVERSE,
}

export async function getSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key)
  return row && !row.deletedAt ? (row.value as SettingValues[K]) : SETTING_DEFAULTS[key]
}

export async function setSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K, value: SettingValues[K]): Promise<void> {
  await db.settings.put({ id: key, value, updatedAt: Date.now() })
}
