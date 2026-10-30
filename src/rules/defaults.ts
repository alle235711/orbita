import type { RuleId } from '../db/schema'

// Le nove regole iniziali (SPEC §4) con le soglie modificabili.
// I testi (titoli, riassunti, etichette) stanno nel dizionario, `regole.rules`.

export type UnitKind = 'days' | 'min' | 'hours'

export interface ThresholdSpec {
  unit?: UnitKind
  min: number
  max: number
  step?: number
  value: number
}

export interface RuleDefinition {
  id: RuleId
  n: number
  thresholds: Record<string, ThresholdSpec>
}

export const RULES: RuleDefinition[] = [
  {
    id: 'esame-vicino',
    n: 1,
    thresholds: { days: { unit: 'days', min: 1, max: 90, value: 21 } },
  },
  {
    id: 'energia-bassa',
    n: 2,
    thresholds: {
      maxEnergy: { min: 1, max: 3, value: 2 },
      block: { unit: 'min', min: 15, max: 90, step: 5, value: 45 },
    },
  },
  {
    id: 'energia-media',
    n: 3,
    thresholds: {
      block: { unit: 'min', min: 30, max: 150, step: 5, value: 90 },
      pause: { unit: 'min', min: 0, max: 45, step: 5, value: 15 },
    },
  },
  {
    id: 'energia-alta',
    n: 4,
    thresholds: {
      minEnergy: { min: 3, max: 5, value: 4 },
      block: { unit: 'min', min: 30, max: 150, step: 5, value: 90 },
    },
  },
  {
    id: 'sport',
    n: 5,
    thresholds: {
      climbs: { min: 0, max: 7, value: 3 },
      deadline: { min: 1, max: 7, value: 4 },
      runs: { min: 0, max: 7, value: 2 },
      minutes: { unit: 'min', min: 15, max: 120, step: 5, value: 40 },
    },
  },
  {
    id: 'lean',
    n: 6,
    thresholds: {
      days: { unit: 'days', min: 1, max: 14, value: 2 },
      minutes: { unit: 'min', min: 10, max: 120, step: 5, value: 30 },
    },
  },
  {
    id: 'ore-settimana',
    n: 7,
    thresholds: {
      hoursPerDay: { unit: 'hours', min: 1, max: 12, step: 0.5, value: 8 },
      maxHours: { unit: 'hours', min: 4, max: 14, step: 0.5, value: 10 },
    },
  },
  {
    id: 'schede-scadute',
    n: 8,
    thresholds: {
      minMinutes: { unit: 'min', min: 5, max: 60, step: 5, value: 15 },
      maxMinutes: { unit: 'min', min: 5, max: 90, step: 5, value: 20 },
    },
  },
  {
    id: 'tirocinio',
    n: 9,
    thresholds: {
      hoursPerDay: { unit: 'hours', min: 1, max: 12, step: 0.5, value: 8 },
      gym: { min: 0, max: 7, value: 3 },
      deadline: { min: 1, max: 7, value: 4 },
      runs: { min: 0, max: 7, value: 2 },
    },
  },
]

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, RuleDefinition>

export function defaultThresholds(id: RuleId): Record<string, number> {
  return Object.fromEntries(Object.entries(RULE_BY_ID[id].thresholds).map(([k, t]) => [k, t.value]))
}
