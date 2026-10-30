import type { ConfigId, GroupId, RuleId } from '../db/schema'

// Le nove regole (SPEC §4) e i gruppi di soglie generali, tutti modificabili.
// I testi (titoli, riassunti, etichette) stanno nel dizionario, `regole`.

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
    thresholds: {
      days: { unit: 'days', min: 1, max: 90, value: 21 },
      warnDays: { unit: 'days', min: 1, max: 60, value: 7 },
    },
  },
  { id: 'energia-bassa', n: 2, thresholds: { maxEnergy: { min: 1, max: 3, value: 2 } } },
  { id: 'energia-media', n: 3, thresholds: {} },
  { id: 'energia-alta', n: 4, thresholds: { minEnergy: { min: 3, max: 5, value: 4 } } },
  { id: 'sport', n: 5, thresholds: { deadline: { min: 1, max: 7, value: 4 } } },
  {
    id: 'abilita',
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
      hoursPerDay: { unit: 'hours', min: 1, max: 12, step: 0.5, value: 6 },
      maxHours: { unit: 'hours', min: 4, max: 14, step: 0.5, value: 10 },
      warnDeficitDays: { min: 0.5, max: 7, step: 0.5, value: 1 },
    },
  },
  {
    id: 'schede-scadute',
    n: 8,
    thresholds: {
      minMinutes: { unit: 'min', min: 5, max: 60, step: 5, value: 15 },
      maxMinutes: { unit: 'min', min: 5, max: 90, step: 5, value: 20 },
      warnDue: { min: 5, max: 500, step: 5, value: 40 },
    },
  },
  { id: 'periodo', n: 9, thresholds: {} },
]

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, RuleDefinition>

const spec = (min: number, max: number, value: number, step = 1, unit?: UnitKind): ThresholdSpec => ({ ...(unit ? { unit } : {}), min, max, step, value })

/** Soglie generali: costanti promosse a valori modificabili (SPEC §9). */
export const GROUPS: Record<GroupId, Record<string, ThresholdSpec>> = {
  giornata: {
    dayStart: spec(240, 720, 480, 15, 'min'),
    dayEnd: spec(960, 1439, 1260, 15, 'min'),
    eveningFrom: spec(720, 1260, 1050, 15, 'min'),
    roundStep: spec(5, 60, 15, 5, 'min'),
    secondExerciseMinutes: spec(15, 180, 60, 5, 'min'),
    walkMinutes: spec(10, 120, 30, 5, 'min'),
    readingMinutes: spec(10, 120, 30, 5, 'min'),
    fillerBelow: spec(1, 8, 4),
  },
  storico: {
    sessionsDays: spec(14, 90, 30, 1, 'days'),
    workoutsDays: spec(7, 60, 14, 1, 'days'),
    eventsDays: spec(1, 30, 7, 1, 'days'),
    typingDays: spec(14, 180, 60, 1, 'days'),
    scoreDays: spec(7, 60, 14, 1, 'days'),
  },
  ripasso: {
    box1: spec(1, 60, 1, 1, 'days'),
    box2: spec(1, 60, 2, 1, 'days'),
    box3: spec(1, 60, 4, 1, 'days'),
    box4: spec(1, 60, 8, 1, 'days'),
    box5: spec(1, 60, 16, 1, 'days'),
    minAccuracy: spec(80, 100, 97),
    minSimilarity: spec(50, 100, 85),
  },
  dattilografia: {
    passAccuracy: spec(80, 100, 95),
    passWpm: spec(5, 120, 25),
    minSeconds: spec(1, 10, 3),
    worstKeys: spec(1, 10, 5),
    worstKeysMinHits: spec(3, 50, 8),
  },
  registra: {
    studyMinutes: spec(5, 300, 90, 5, 'min'),
    lavoroMinutes: spec(5, 300, 60, 5, 'min'),
    abilitaMinutes: spec(5, 300, 30, 5, 'min'),
    linguaMinutes: spec(5, 300, 15, 5, 'min'),
    letturaMinutes: spec(5, 300, 30, 5, 'min'),
  },
}

export const GROUP_IDS = Object.keys(GROUPS) as GroupId[]

export type Tuning = Record<GroupId, Record<string, number>>

export function defaultThresholds(id: ConfigId): Record<string, number> {
  const specs = id in GROUPS ? GROUPS[id as GroupId] : RULE_BY_ID[id as RuleId].thresholds
  return Object.fromEntries(Object.entries(specs).map(([k, t]) => [k, t.value]))
}

/** Una soglia valida: dentro i limiti e sul passo previsto. */
export function clampThreshold(s: ThresholdSpec, value: number): number {
  if (!Number.isFinite(value)) return s.value
  const step = s.step ?? 1
  const stepped = Math.round(value / step) * step
  return Math.min(s.max, Math.max(s.min, Number(stepped.toFixed(4))))
}

/** I valori predefiniti di tutti i gruppi. */
export const DEFAULT_TUNING: Tuning = Object.fromEntries(GROUP_IDS.map((g) => [g, defaultThresholds(g)])) as Tuning

/** Gruppi salvati + predefiniti, ogni valore riportato dentro i suoi limiti. */
export function resolveGroups(saved: { id: string; deletedAt?: number; thresholds: Record<string, number> }[] = []): Tuning {
  const byId = new Map(saved.filter((r) => !r.deletedAt).map((r) => [r.id, r]))
  return Object.fromEntries(
    GROUP_IDS.map((g) => {
      const row = byId.get(g)
      const out: Record<string, number> = {}
      for (const [k, s] of Object.entries(GROUPS[g])) out[k] = clampThreshold(s, row?.thresholds?.[k] ?? s.value)
      return [g, out]
    }),
  ) as Tuning
}

/** Limiti delle soglie del suggerimento sui blocchi (la quota è in percentuale). */
export const HINT_SPECS = {
  lookbackDays: { unit: 'days', min: 7, max: 60, value: 14 },
  minSessions: { min: 3, max: 30, value: 6 },
  minShare: { min: 30, max: 100, step: 5, value: 50 },
  overrunPct: { min: 0, max: 50, value: 10 },
} satisfies Record<string, ThresholdSpec>
