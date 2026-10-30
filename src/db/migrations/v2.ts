// Migrazione dei dati dalla versione 1 alla 2: funzione pura, deterministica
// e idempotente (nessun orologio, nessun caso, nessun I/O). La stessa
// trasformazione gira nell'aggiornamento di Dexie e all'importazione di un
// backup di formato 1, così i due percorsi danno le stesse righe.
//
// Gli id e i tipi della versione 1 ('lean', 'inglese', 'tirocinio', 'laurea')
// compaiono solo qui: servono a leggere i dati vecchi.

import { presetFromBlock } from '../../rules/blocks'
import { DEFAULT_STUDY_BLOCK, type ModulesSettings } from '../../modules/types'
import { DEFAULT_PROFILE_FIELDS } from '../profile'
import type { TableName } from '../schema'

export type RawRow = Record<string, unknown> & { id: string; updatedAt: number; deletedAt?: number }
export type RawTables = Partial<Record<TableName, RawRow[]>>

export const V2_INPUT_TABLES: TableName[] = ['settings', 'rules', 'deadlines', 'sessions', 'courses', 'workouts', 'weights']

export const SEED_VERSION_V2 = 2

const DEFAULT_PERIOD_HOURS = 8
const DEFAULT_PERIOD_GYM = 3
const DEFAULT_PERIOD_RUNS = 2
const DEFAULT_SPORT_DEADLINE = 4
const DEFAULT_CLIMBS = 3
const DEFAULT_RUNS = 2
const DEFAULT_RUN_MINUTES = 40
const DEFAULT_MIDDLE_BLOCK = 90
const CLIMB_MINUTES = 120
const GYM_MINUTES = 60
const SWIM_MINUTES = 45
const OTHER_SPORT_MINUTES = 45

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

/** Massimo `updatedAt` delle righe presenti; 0 se non ce ne sono. */
const maxU = (...rows: (RawRow | undefined)[]): number => rows.reduce((m, r) => (r && typeof r.updatedAt === 'number' && r.updatedAt > m ? r.updatedAt : m), 0)

const SESSION_TYPE_V1: Record<string, string> = { lean: 'abilita', inglese: 'lingua' }

function thresholdsOf(row: RawRow | undefined): Record<string, unknown> {
  return row && isObject(row.thresholds) ? row.thresholds : {}
}

function migrateSessions(rows: RawRow[]): RawRow[] {
  return rows.map((r) => (typeof r.type === 'string' && r.type in SESSION_TYPE_V1 ? { ...r, type: SESSION_TYPE_V1[r.type] } : r))
}

function migrateActiveTimer(value: unknown): unknown {
  if (!isObject(value) || typeof value.type !== 'string' || !(value.type in SESSION_TYPE_V1)) return value
  return { ...value, type: SESSION_TYPE_V1[value.type] }
}

function migrateRules(rows: RawRow[]): RawRow[] {
  const ids = new Set(rows.map((r) => r.id))
  const out: RawRow[] = []
  for (const r of rows) {
    const t = thresholdsOf(r)
    switch (r.id) {
      case 'lean':
        // Se esiste già la regola nuova vince quella: la vecchia sparisce.
        if (!ids.has('abilita')) out.push({ ...r, id: 'abilita' })
        break
      case 'tirocinio':
        if (!ids.has('periodo')) out.push({ ...r, id: 'periodo', thresholds: {} })
        break
      case 'sport':
        out.push({ ...r, thresholds: { deadline: num(t.deadline) ?? DEFAULT_SPORT_DEADLINE } })
        break
      case 'energia-bassa':
      case 'energia-alta': {
        const { block: _block, ...rest } = t
        out.push({ ...r, thresholds: rest })
        break
      }
      case 'energia-media': {
        const { block: _block, pause: _pause, ...rest } = t
        out.push({ ...r, thresholds: rest })
        break
      }
      default:
        out.push(r)
    }
  }
  return out
}

function migrateDeadlines(rows: RawRow[], rulesBefore: Map<string, RawRow>): RawRow[] {
  const out: RawRow[] = []
  const rule = rulesBefore.get('tirocinio')
  const t = thresholdsOf(rule)
  for (const r of rows) {
    if (r.id === 'laurea' || r.kind === 'laurea') continue
    if (r.id !== 'tirocinio') {
      out.push(r)
      continue
    }
    const next: RawRow = { ...r }
    let added = false
    if (next.hoursPerDay === undefined) {
      next.hoursPerDay = num(t.hoursPerDay) ?? DEFAULT_PERIOD_HOURS
      added = true
    }
    if (next.sport === undefined) {
      next.sport = { arrampicata: 0, palestra: num(t.gym) ?? DEFAULT_PERIOD_GYM, corsa: num(t.runs) ?? DEFAULT_PERIOD_RUNS }
      added = true
    }
    if (next.deadlineDay === undefined) {
      next.deadlineDay = num(t.deadline) ?? DEFAULT_SPORT_DEADLINE
      added = true
    }
    if (added) next.updatedAt = maxU(r, rule)
    out.push(next)
  }
  return out
}

function derivedModules(rulesBefore: Map<string, RawRow>): ModulesSettings {
  const sport = thresholdsOf(rulesBefore.get('sport'))
  const climbs = num(sport.climbs) ?? DEFAULT_CLIMBS
  const runs = num(sport.runs) ?? DEFAULT_RUNS
  const minutes = num(sport.minutes) ?? DEFAULT_RUN_MINUTES
  return {
    sport: {
      enabled: true,
      types: {
        arrampicata: { enabled: true, target: climbs, minutes: CLIMB_MINUTES },
        corsa: { enabled: true, target: runs, minutes },
        palestra: { enabled: true, target: 0, minutes: GYM_MINUTES },
        nuoto: { enabled: false, target: 0, minutes: SWIM_MINUTES },
        altro: { enabled: false, target: 0, minutes: OTHER_SPORT_MINUTES },
      },
    },
    dattilografia: { enabled: true },
    abilita: { enabled: true },
    lingua: { enabled: true },
    lavoro: { enabled: true },
    lettura: { enabled: true },
    peso: { enabled: true },
  }
}

function migrateSettings(rows: RawRow[], rulesBefore: Map<string, RawRow>, deadlinesBefore: RawRow[] | undefined): RawRow[] {
  const out: RawRow[] = rows.map((r) => {
    if (r.id === 'seedVersion' && typeof r.value === 'number' && r.value < SEED_VERSION_V2) return { ...r, value: SEED_VERSION_V2 }
    if (r.id === 'activeTimer') return { ...r, value: migrateActiveTimer(r.value) }
    return r
  })
  const has = (id: string) => rows.some((r) => r.id === id)

  if (!has('profile')) {
    const laureaRows = (deadlinesBefore ?? []).filter((d) => d.id === 'laurea' || d.kind === 'laurea')
    const target = laureaRows.find((d) => typeof d.date === 'string' && d.date)
    out.push({
      id: 'profile',
      value: { ...DEFAULT_PROFILE_FIELDS, ...(target ? { graduationTarget: target.date } : {}) },
      updatedAt: maxU(...laureaRows),
    })
  }
  if (!has('studyBlock')) {
    const mid = rulesBefore.get('energia-media')
    const block = num(thresholdsOf(mid).block) ?? DEFAULT_MIDDLE_BLOCK
    out.push({
      id: 'studyBlock',
      value: { preset: presetFromBlock(block), hint: { ...DEFAULT_STUDY_BLOCK.hint } },
      updatedAt: maxU(mid, rulesBefore.get('energia-bassa'), rulesBefore.get('energia-alta')),
    })
  }
  if (!has('modules')) {
    out.push({ id: 'modules', value: derivedModules(rulesBefore), updatedAt: maxU(rulesBefore.get('sport'), rulesBefore.get('lean')) })
  }
  return out
}

/** Restituisce la versione migrata di ogni tabella presente in ingresso (le assenti restano assenti). L'ingresso non viene modificato. */
export function migrateToV2(input: RawTables): RawTables {
  const src = structuredClone(input)
  const out: RawTables = { ...src }
  const rulesBefore = new Map((src.rules ?? []).map((r) => [r.id, r]))

  if (src.sessions) out.sessions = migrateSessions(src.sessions)
  if (src.rules) out.rules = migrateRules(src.rules)
  if (src.deadlines) out.deadlines = migrateDeadlines(src.deadlines, rulesBefore)
  if (src.settings) out.settings = migrateSettings(src.settings, rulesBefore, src.deadlines)
  return out
}

export interface TableChanges {
  put: RawRow[]
  deleteIds: string[]
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a as object).filter((k) => (a as Record<string, unknown>)[k] !== undefined)
  const kb = Object.keys(b as object).filter((k) => (b as Record<string, unknown>)[k] !== undefined)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** Righe di `after` diverse o mancanti in `before` → put; id di `before` mancanti in `after` → deleteIds. Solo tabelle presenti in entrambi. */
export function diffTables(before: RawTables, after: RawTables): Partial<Record<TableName, TableChanges>> {
  const result: Partial<Record<TableName, TableChanges>> = {}
  for (const name of Object.keys(before) as TableName[]) {
    const b = before[name]
    const a = after[name]
    if (!b || !a) continue
    const old = new Map(b.map((r) => [r.id, r]))
    const kept = new Set(a.map((r) => r.id))
    result[name] = {
      put: a.filter((r) => !deepEqual(old.get(r.id), r)),
      deleteIds: b.filter((r) => !kept.has(r.id)).map((r) => r.id),
    }
  }
  return result
}
