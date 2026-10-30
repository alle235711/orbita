// Dati finti per i test: nomi inventati, date e difficoltà identiche a quelle
// dell'anno di prova della fase 1, così le attese numeriche restano le stesse.

import type { Course, Deadline, RuleConfig } from '../db/schema'
import type { RawTables } from '../db/migrations/v2'
import { RULES, defaultThresholds } from '../rules/defaults'
import type { RuleContext } from '../rules/types'
import { DEFAULT_MODULES, type ModulesSettings } from '../modules/types'
import { DEFAULT_STUDY_BLOCK } from '../modules/types'

export const FAKE_COURSES: Course[] = [
  {
    id: 'c-fis',
    name: 'Fisica Moderna',
    code: '10001',
    degree: 'Laurea in Fisica',
    examDate: '2026-11-13',
    examNotes: 'Scritto con due esercizi, poi orale.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  { id: 'c-calc', name: 'Calcolo Numerico', degree: 'Laurea in Fisica', examDate: '2026-11-17', sections: [], difficulty: 2, semester: 1, updatedAt: 0 },
  { id: 'c-alg', name: 'Algebra Commutativa', degree: 'Laurea in Matematica', examDate: '2027-02', sections: [], difficulty: 2, semester: 1, updatedAt: 0 },
  {
    id: 'c-top',
    name: 'Topologia Generale',
    code: '10002',
    degree: 'Laurea in Matematica',
    examDate: '2027-02',
    examNotes: 'Solo orale.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  {
    id: 'c-ast',
    name: 'Cosmologia Osservativa',
    code: '10003',
    degree: 'Laurea in Fisica',
    examDate: '2027-02',
    examNotes: 'Prova scritta propedeutica.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  { id: 'c-tdn', name: 'Teoria dei Gruppi', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
  { id: 'c-geo', name: 'Geometria Differenziale', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
  { id: 'c-ana', name: 'Analisi Funzionale', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
]

/** Un periodo speciale senza date (come il tirocinio della fase 1 prima di compilarlo). */
export const FAKE_DEADLINES: Deadline[] = [{ id: 'periodo-prova', title: 'Periodo di prova', kind: 'periodo', updatedAt: 0 }]

/** Laurea prevista usata dai test del righello (era la scadenza `laurea`). */
export const FAKE_GRADUATION = '2027-07'

/** Le nove regole con le soglie predefinite, come le scriveva il seed della fase 1. */
export function fakeRules(): RuleConfig[] {
  // Le ore al giorno restano 8 come nella fase 1: il nuovo predefinito (6) vale solo per le righe che non esistono.
  return RULES.map((r) => ({ id: r.id, enabled: true, thresholds: { ...defaultThresholds(r.id), ...(r.id === 'ore-settimana' ? { hoursPerDay: 8 } : {}) }, updatedAt: 0 }))
}

/** Moduli come nella fase 1: tutto acceso, sport con arrampicata, palestra e corsa. */
export const PHASE1_MODULES: ModulesSettings = {
  ...DEFAULT_MODULES,
  sport: {
    enabled: true,
    types: {
      ...DEFAULT_MODULES.sport.types,
      arrampicata: { enabled: true, target: 3, minutes: 120 },
      palestra: { enabled: true, target: 0, minutes: 60 },
      corsa: { enabled: true, target: 2, minutes: 40 },
    },
  },
  abilita: { enabled: true, name: 'Chitarra' },
  lingua: { enabled: true },
  lavoro: { enabled: true },
  peso: { enabled: true },
}

/** Contesto delle regole completo, con i valori che mantengono i numeri della fase 1 (blocco 90/15). */
export function makeContext(over: Partial<RuleContext> = {}): RuleContext {
  return {
    today: '2026-10-27',
    now: 8 * 60,
    energy: 3,
    courses: structuredClone(FAKE_COURSES),
    deadlines: structuredClone(FAKE_DEADLINES),
    events: [],
    sessions: [],
    workouts: [],
    cards: { due: {}, fresh: {} },
    rules: fakeRules(),
    profile: null,
    modules: structuredClone(PHASE1_MODULES),
    studyBlock: { ...DEFAULT_STUDY_BLOCK, preset: '90/15' },
    ...over,
  }
}

/** Un database della fase 1 scritto a mano ('lean', 'tirocinio', 'laurea', 'inglese' sono gli identificatori della versione 1, che la migrazione deve leggere): nomi finti, ma gli id e i tipi del vecchio formato. */
export function v1Fixture(): RawTables {
  return {
    settings: [
      { id: 'seedVersion', value: 1, updatedAt: 0 },
      { id: 'newCardsPerDay', value: 12, updatedAt: 500 },
      { id: 'targetAverage', value: 28, updatedAt: 0 },
      { id: 'cardsImported', value: { version: 2, date: '2026-09-01' }, updatedAt: 0 },
      { id: 'lastBackupAt', value: 1_700_000_000_000, updatedAt: 600 },
      { id: 'language', value: { base: 'it', otherDays: [2] }, updatedAt: 700 },
      { id: 'activeTimer', value: { key: 'lean', title: 'Pratica', kind: 'session', type: 'lean', startedAt: 1_700_000_100_000 }, updatedAt: 800 },
    ],
    rules: [
      { id: 'esame-vicino', enabled: true, thresholds: { days: 21 }, updatedAt: 0 },
      { id: 'energia-bassa', enabled: true, thresholds: { maxEnergy: 2, block: 45 }, updatedAt: 0 },
      { id: 'energia-media', enabled: true, thresholds: { block: 70, pause: 15 }, updatedAt: 3000 },
      { id: 'energia-alta', enabled: true, thresholds: { minEnergy: 4, block: 90 }, updatedAt: 0 },
      { id: 'sport', enabled: true, thresholds: { climbs: 4, deadline: 5, runs: 3, minutes: 35 }, updatedAt: 2000 },
      { id: 'lean', enabled: false, thresholds: { days: 3, minutes: 25 }, updatedAt: 1500 },
      { id: 'ore-settimana', enabled: true, thresholds: { hoursPerDay: 8, maxHours: 10 }, updatedAt: 0 },
      { id: 'schede-scadute', enabled: true, thresholds: { minMinutes: 15, maxMinutes: 20 }, updatedAt: 0 },
      { id: 'tirocinio', enabled: true, thresholds: { hoursPerDay: 7, gym: 2, deadline: 3, runs: 1 }, updatedAt: 4000 },
    ],
    deadlines: [
      { id: 'tirocinio', title: 'Periodo estivo', kind: 'periodo', date: '2027-03-15', endDate: '2027-04-24', notes: 'Note del periodo', updatedAt: 2500 },
      { id: 'laurea', title: 'Laurea', kind: 'laurea', date: '2027-07', notes: 'Obiettivo prova', updatedAt: 900 },
      { id: 'esame-extra', title: 'Consegna progetto', kind: 'scadenza', date: '2026-12-01', updatedAt: 1200 },
    ],
    sessions: [
      { id: 's1', date: '2026-10-20', minutes: 40, type: 'lean', updatedAt: 1000 },
      { id: 's2', date: '2026-10-21', minutes: 15, type: 'inglese', score: 71, notes: 'app', updatedAt: 1100 },
      { id: 's3', date: '2026-10-22', minutes: 90, type: 'studio', courseId: 'c-fis', updatedAt: 1300 },
      { id: 's4', date: '2026-10-23', minutes: 30, type: 'lettura', updatedAt: 0 },
    ],
    courses: structuredClone(FAKE_COURSES.slice(0, 3)) as unknown as RawTables['courses'],
    workouts: [{ id: 'w1', date: '2026-10-22', type: 'corsa', minutes: 40, updatedAt: 1400 }],
    weights: [{ id: 'g1', date: '2026-10-22', kg: 70.5, updatedAt: 1400 }],
  }
}
