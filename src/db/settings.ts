import type { OrbitaDB } from './db'

export interface ActiveTimer {
  /** Chiave della voce del piano avviata. */
  key: string
  title: string
  kind: 'session' | 'workout'
  type: string
  courseId?: string
  startedAt: number
}

/** Le impostazioni conosciute, con il loro tipo e il valore predefinito. */
export interface SettingValues {
  newCardsPerDay: number
  targetAverage: number
  lastBackupAt: number | null
  activeTimer: ActiveTimer | null
}

export const SETTING_DEFAULTS: SettingValues = {
  newCardsPerDay: 15,
  targetAverage: 28,
  lastBackupAt: null,
  activeTimer: null,
}

export async function getSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K): Promise<SettingValues[K]> {
  const row = await db.settings.get(key)
  return row && !row.deletedAt ? (row.value as SettingValues[K]) : SETTING_DEFAULTS[key]
}

export async function setSetting<K extends keyof SettingValues>(db: OrbitaDB, key: K, value: SettingValues[K]): Promise<void> {
  await db.settings.put({ id: key, value, updatedAt: Date.now() })
}
