import { DEFAULT_LANGUAGE, type LanguageSettings } from '../i18n/lang'
import { DEFAULT_MODULES, DEFAULT_STUDY_BLOCK, type ModulesSettings, type StudyBlockSettings } from '../modules/types'
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
}

export async function getSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key)
  return row && !row.deletedAt ? (row.value as SettingValues[K]) : SETTING_DEFAULTS[key]
}

export async function setSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K, value: SettingValues[K]): Promise<void> {
  await db.settings.put({ id: key, value, updatedAt: Date.now() })
}
