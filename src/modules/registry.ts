// Registro dei moduli attivabili: per ognuno dice quali superfici (voci di
// menu, tipi di sessione, regole, pannelli) compaiono quando è acceso. I dati
// di un modulo spento restano; si nasconde solo ciò che si vede.

import type { RouteId } from '../app/router'
import type { Dict } from '../i18n/dict'
import { WORKOUT_ORDER, type EventType, type RuleId, type SessionType, type WorkoutType } from '../db/schema'
import type { ModuleId, ModulesSettings } from './types'

export type QuickLogKind = 'studio' | 'lavoro' | WorkoutType | 'abilita' | 'lingua' | 'lettura' | 'peso'
export type StatsPanelId = 'sport' | 'typing' | 'language' | 'ability' | 'weight' | 'workHours'
export type BriefingTileId = 'sport' | 'ability' | 'language' | 'typing'

export interface ModuleDef {
  id: ModuleId
  routes: RouteId[]
  sessionTypes: SessionType[]
  workoutTypes: WorkoutType[]
  eventTypes: EventType[]
  rules: RuleId[]
  quickLog: QuickLogKind[]
  statsPanels: StatsPanelId[]
  briefingTiles: BriefingTileId[]
}

export const MODULE_IDS: readonly ModuleId[] = ['sport', 'dattilografia', 'abilita', 'lingua', 'lavoro', 'lettura', 'peso']

const none = { routes: [], sessionTypes: [], workoutTypes: [], eventTypes: [], rules: [], quickLog: [], statsPanels: [], briefingTiles: [] } satisfies Omit<ModuleDef, 'id'>

export const MODULES: Record<ModuleId, ModuleDef> = {
  sport: { ...none, id: 'sport', workoutTypes: [...WORKOUT_ORDER], eventTypes: ['sport'], rules: ['sport'], quickLog: [...WORKOUT_ORDER], statsPanels: ['sport'], briefingTiles: ['sport'] },
  dattilografia: { ...none, id: 'dattilografia', routes: ['dattilografia'], sessionTypes: ['dattilografia'], statsPanels: ['typing'], briefingTiles: ['typing'] },
  abilita: { ...none, id: 'abilita', sessionTypes: ['abilita'], rules: ['abilita'], quickLog: ['abilita'], statsPanels: ['ability'], briefingTiles: ['ability'] },
  lingua: { ...none, id: 'lingua', sessionTypes: ['lingua'], quickLog: ['lingua'], statsPanels: ['language'], briefingTiles: ['language'] },
  lavoro: { ...none, id: 'lavoro', sessionTypes: ['lavoro'], eventTypes: ['lavoro'], quickLog: ['lavoro'], statsPanels: ['workHours'] },
  lettura: { ...none, id: 'lettura', sessionTypes: ['lettura'], quickLog: ['lettura'] },
  peso: { ...none, id: 'peso', quickLog: ['peso'], statsPanels: ['weight'] },
}

export function isEnabled(m: ModulesSettings, id: ModuleId): boolean {
  return m[id].enabled
}

export function enabledModules(m: ModulesSettings): ModuleDef[] {
  return MODULE_IDS.filter((id) => isEnabled(m, id)).map((id) => MODULES[id])
}

/** Le sezioni di base sono sempre accese. */
export function routeEnabled(m: ModulesSettings, route: RouteId): boolean {
  const owner = MODULE_IDS.find((id) => MODULES[id].routes.includes(route))
  return owner ? isEnabled(m, owner) : true
}

/** `studio` e `ripasso` sono di base. */
export function sessionTypeEnabled(m: ModulesSettings, t: SessionType): boolean {
  const owner = MODULE_IDS.find((id) => MODULES[id].sessionTypes.includes(t))
  return owner ? isEnabled(m, owner) : true
}

export function workoutTypeEnabled(m: ModulesSettings, t: WorkoutType): boolean {
  return m.sport.enabled && m.sport.types[t].enabled
}

/** Lo sport e l'abilità seguono il loro modulo, le altre regole sono di base. */
export function ruleEnabledByModule(m: ModulesSettings, r: RuleId): boolean {
  const owner = MODULE_IDS.find((id) => MODULES[id].rules.includes(r))
  return owner ? isEnabled(m, owner) : true
}

/** Voci di Registra, in ordine: studio, lavoro, sport attivi, abilità, lingua, lettura, peso. */
export function quickLogKinds(m: ModulesSettings): QuickLogKind[] {
  const out: QuickLogKind[] = ['studio']
  if (m.lavoro.enabled) out.push('lavoro')
  out.push(...WORKOUT_ORDER.filter((t) => workoutTypeEnabled(m, t)))
  if (m.abilita.enabled) out.push('abilita')
  if (m.lingua.enabled) out.push('lingua')
  if (m.lettura.enabled) out.push('lettura')
  if (m.peso.enabled) out.push('peso')
  return out
}

export function statsPanels(m: ModulesSettings): Set<StatsPanelId> {
  return new Set(enabledModules(m).flatMap((d) => d.statsPanels))
}

export function briefingTiles(m: ModulesSettings): Set<BriefingTileId> {
  return new Set(enabledModules(m).flatMap((d) => d.briefingTiles))
}

const CORE_EVENT_TYPES: EventType[] = ['lezione', 'studio', 'esame', 'altro']

export function eventTypeEnabled(m: ModulesSettings, t: EventType): boolean {
  if (CORE_EVENT_TYPES.includes(t)) return true
  const owner = MODULE_IDS.find((id) => MODULES[id].eventTypes.includes(t))
  return owner ? isEnabled(m, owner) : true
}

/** I tipi di sessione che contano come ore di studio e lavoro. */
export function workSessionTypes(m: ModulesSettings): SessionType[] {
  return m.lavoro.enabled ? ['studio', 'ripasso', 'lavoro'] : ['studio', 'ripasso']
}

/** Il nome mostrato: quello scritto dall'utente per abilità e lingua, altrimenti quello del dizionario. */
export function moduleLabel(m: ModulesSettings, id: ModuleId, t: Dict): string {
  if (id === 'abilita') return m.abilita.name || t.modules.abilita.fallback
  if (id === 'lingua') return m.lingua.appName || t.modules.lingua.fallback
  return t.modules[id].label
}
