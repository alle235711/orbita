// Moduli attivabili, blocchi di studio e relativi normalizzatori. Tipi puri,
// senza dipendenze dal database: li usano impostazioni, migrazione e regole.

import { WORKOUT_ORDER, type WorkoutType } from '../db/schema'

export type ModuleId = 'sport' | 'dattilografia' | 'abilita' | 'lingua' | 'lavoro' | 'lettura' | 'peso'

export interface SportTypeConfig {
  enabled: boolean
  /** Volte a settimana, 0..7. */
  target: number
  /** Minuti per sessione, 5..300 a passi di 5. */
  minutes: number
}

export interface ModulesSettings {
  sport: { enabled: boolean; types: Record<WorkoutType, SportTypeConfig> }
  dattilografia: { enabled: boolean }
  abilita: { enabled: boolean; name?: string }
  lingua: { enabled: boolean; appName?: string }
  lavoro: { enabled: boolean }
  lettura: { enabled: boolean }
  peso: { enabled: boolean }
}

export const DEFAULT_MODULES: ModulesSettings = {
  sport: {
    enabled: true,
    types: {
      arrampicata: { enabled: false, target: 2, minutes: 120 },
      palestra: { enabled: false, target: 2, minutes: 60 },
      corsa: { enabled: true, target: 2, minutes: 40 },
      nuoto: { enabled: false, target: 2, minutes: 45 },
      altro: { enabled: false, target: 1, minutes: 45 },
    },
  },
  dattilografia: { enabled: true },
  abilita: { enabled: false },
  lingua: { enabled: false },
  lavoro: { enabled: false },
  lettura: { enabled: true },
  peso: { enabled: false },
}

export const MAX_MODULE_NAME = 40
const SPORT_TARGET_MAX = 7
const SPORT_MINUTES_MIN = 5
const SPORT_MINUTES_MAX = 300
const SPORT_MINUTES_STEP = 5

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

function clampInt(raw: unknown, min: number, max: number, fallback: number, step = 1): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback
  const stepped = Math.round(raw / step) * step
  return Math.min(max, Math.max(min, stepped))
}

function cleanName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const s = raw.trim().slice(0, MAX_MODULE_NAME).trim()
  return s || undefined
}

/** Accetta qualsiasi valore: completa le chiavi mancanti dai predefiniti, limita i numeri, ripulisce i nomi. Non lancia mai. */
export function normalizeModules(raw: unknown): ModulesSettings {
  const o = isObject(raw) ? raw : {}
  const d = DEFAULT_MODULES
  const sport = isObject(o.sport) ? o.sport : {}
  const types = isObject(sport.types) ? sport.types : {}
  const outTypes = {} as Record<WorkoutType, SportTypeConfig>
  for (const t of WORKOUT_ORDER) {
    const c = isObject(types[t]) ? (types[t] as Record<string, unknown>) : {}
    outTypes[t] = {
      enabled: bool(c.enabled, d.sport.types[t].enabled),
      target: clampInt(c.target, 0, SPORT_TARGET_MAX, d.sport.types[t].target),
      minutes: clampInt(c.minutes, SPORT_MINUTES_MIN, SPORT_MINUTES_MAX, d.sport.types[t].minutes, SPORT_MINUTES_STEP),
    }
  }
  const flag = (id: 'dattilografia' | 'lavoro' | 'lettura' | 'peso') => ({
    enabled: bool(isObject(o[id]) ? (o[id] as Record<string, unknown>).enabled : undefined, d[id].enabled),
  })
  const abilita = isObject(o.abilita) ? o.abilita : {}
  const lingua = isObject(o.lingua) ? o.lingua : {}
  const abName = cleanName(abilita.name)
  const appName = cleanName(lingua.appName)
  return {
    sport: { enabled: bool(sport.enabled, d.sport.enabled), types: outTypes },
    dattilografia: flag('dattilografia'),
    abilita: { enabled: bool(abilita.enabled, d.abilita.enabled), ...(abName ? { name: abName } : {}) },
    lingua: { enabled: bool(lingua.enabled, d.lingua.enabled), ...(appName ? { appName } : {}) },
    lavoro: flag('lavoro'),
    lettura: flag('lettura'),
    peso: flag('peso'),
  }
}

export type BlockPreset = '25/5' | '45/10' | '50/10' | '90/15'
export const BLOCK_PRESET_IDS: readonly BlockPreset[] = ['25/5', '45/10', '50/10', '90/15']

export interface StudyBlockHint {
  enabled: boolean
  lookbackDays: number
  minSessions: number
  minShare: number
  overrunPct: number
}

export interface StudyBlockSettings {
  preset: BlockPreset
  hint: StudyBlockHint
}

export const DEFAULT_STUDY_BLOCK: StudyBlockSettings = {
  preset: '50/10',
  hint: { enabled: true, lookbackDays: 14, minSessions: 6, minShare: 0.5, overrunPct: 10 },
}

/** Preset non valido → '50/10'; soglie del suggerimento limitate ai loro intervalli. Non lancia mai. */
export function normalizeStudyBlock(raw: unknown): StudyBlockSettings {
  const o = isObject(raw) ? raw : {}
  const h = isObject(o.hint) ? o.hint : {}
  const d = DEFAULT_STUDY_BLOCK.hint
  const share = typeof h.minShare === 'number' && Number.isFinite(h.minShare) ? Math.min(1, Math.max(0.3, Math.round(h.minShare * 20) / 20)) : d.minShare
  return {
    preset: BLOCK_PRESET_IDS.includes(o.preset as BlockPreset) ? (o.preset as BlockPreset) : DEFAULT_STUDY_BLOCK.preset,
    hint: {
      enabled: bool(h.enabled, d.enabled),
      lookbackDays: clampInt(h.lookbackDays, 7, 60, d.lookbackDays),
      minSessions: clampInt(h.minSessions, 3, 30, d.minSessions),
      minShare: share,
      overrunPct: clampInt(h.overrunPct, 0, 50, d.overrunPct),
    },
  }
}
