import type { RuleId } from '../db/schema'

// Le nove regole iniziali (SPEC §4) con le soglie modificabili.
// `label` e `unit` servono alla schermata Regole.

export interface ThresholdSpec {
  label: string
  unit?: string
  min: number
  max: number
  step?: number
  value: number
}

export interface RuleDefinition {
  id: RuleId
  n: number
  title: string
  /** La regola in una riga: "se … → …" */
  summary: string
  thresholds: Record<string, ThresholdSpec>
}

export const RULES: RuleDefinition[] = [
  {
    id: 'esame-vicino',
    n: 1,
    title: 'Esame vicino',
    summary: 'Un esame entro la soglia rende quella materia la priorità 1.',
    thresholds: { days: { label: 'Giorni all’esame', unit: 'giorni', min: 1, max: 90, value: 21 } },
  },
  {
    id: 'energia-bassa',
    n: 2,
    title: 'Energia bassa',
    summary: 'Sgr A* e LINER: niente teoria nuova, blocchi brevi, ripasso attivo e schede.',
    thresholds: {
      maxEnergy: { label: 'Fino al livello', min: 1, max: 3, value: 2 },
      block: { label: 'Durata dei blocchi', unit: 'min', min: 15, max: 90, step: 5, value: 45 },
    },
  },
  {
    id: 'energia-media',
    n: 3,
    title: 'Energia regolare',
    summary: 'Seyfert: l’esame più vicino per primo, blocchi lunghi con una pausa.',
    thresholds: {
      block: { label: 'Durata dei blocchi', unit: 'min', min: 30, max: 150, step: 5, value: 90 },
      pause: { label: 'Pausa dopo ogni blocco', unit: 'min', min: 0, max: 45, step: 5, value: 15 },
    },
  },
  {
    id: 'energia-alta',
    n: 4,
    title: 'Energia alta',
    summary: 'Quasar e Blazar: la teoria più difficile nelle prime ore.',
    thresholds: {
      minEnergy: { label: 'Dal livello', min: 3, max: 5, value: 4 },
      block: { label: 'Durata dei blocchi', unit: 'min', min: 30, max: 150, step: 5, value: 90 },
    },
  },
  {
    id: 'sport',
    n: 5,
    title: 'Arrampicata e corsa',
    summary: 'Meno arrampicate del previsto entro giovedì: proponi una sessione. Poche corse: proponi una corsa.',
    thresholds: {
      climbs: { label: 'Arrampicate a settimana', min: 0, max: 7, value: 3 },
      deadline: { label: 'Entro il giorno (1 = lunedì)', min: 1, max: 7, value: 4 },
      runs: { label: 'Corse a settimana', min: 0, max: 7, value: 2 },
      minutes: { label: 'Durata di una corsa', unit: 'min', min: 15, max: 120, step: 5, value: 40 },
    },
  },
  {
    id: 'lean',
    n: 6,
    title: 'Lean fermo',
    summary: 'Lean fermo da più giorni della soglia: mezz’ora nel piano del giorno dopo.',
    thresholds: {
      days: { label: 'Giorni senza Lean', unit: 'giorni', min: 1, max: 14, value: 2 },
      minutes: { label: 'Minuti da inserire', unit: 'min', min: 10, max: 120, step: 5, value: 30 },
    },
  },
  {
    id: 'ore-settimana',
    n: 7,
    title: 'Ore della settimana',
    summary: 'Ore degli ultimi 7 giorni sotto l’obiettivo: alza l’obiettivo di domani.',
    thresholds: {
      hoursPerDay: { label: 'Ore al giorno', unit: 'h', min: 1, max: 12, step: 0.5, value: 8 },
      maxHours: { label: 'Massimo per domani', unit: 'h', min: 4, max: 14, step: 0.5, value: 10 },
    },
  },
  {
    id: 'schede-scadute',
    n: 8,
    title: 'Schede scadute',
    summary: 'Ci sono schede di ripasso scadute: inserisci il ripasso a 10 dita.',
    thresholds: {
      minMinutes: { label: 'Minimo', unit: 'min', min: 5, max: 60, step: 5, value: 15 },
      maxMinutes: { label: 'Massimo', unit: 'min', min: 5, max: 90, step: 5, value: 20 },
    },
  },
  {
    id: 'tirocinio',
    n: 9,
    title: 'Tirocinio alle Maldive',
    summary: 'Durante il tirocinio valgono obiettivo orario e sport a parte: palestra e corsa al posto dell’arrampicata.',
    thresholds: {
      hoursPerDay: { label: 'Ore al giorno', unit: 'h', min: 1, max: 12, step: 0.5, value: 8 },
      gym: { label: 'Palestra a settimana', min: 0, max: 7, value: 3 },
      deadline: { label: 'Entro il giorno (1 = lunedì)', min: 1, max: 7, value: 4 },
      runs: { label: 'Corse a settimana', min: 0, max: 7, value: 2 },
    },
  },
]

export const RULE_BY_ID = Object.fromEntries(RULES.map((r) => [r.id, r])) as Record<RuleId, RuleDefinition>

export function defaultThresholds(id: RuleId): Record<string, number> {
  return Object.fromEntries(Object.entries(RULE_BY_ID[id].thresholds).map(([k, t]) => [k, t.value]))
}
