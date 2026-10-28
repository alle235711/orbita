import { RULES, defaultThresholds } from '../rules/defaults'
import type { OrbitaDB } from './db'
import type { Course, Deadline, RuleConfig, Setting } from './schema'

// Corsi e scadenze dell'anno 2026/2027 (SPEC §6). Tutte le date restano
// modificabili dalla pagina Dati; updatedAt = 0 vuol dire "mai modificato".

export const SEED_VERSION = 1

export const SEED_COURSES: Course[] = [
  {
    id: 'sdm',
    name: 'Struttura della Materia',
    code: '67114',
    degree: 'Laurea in Astronomia',
    examDate: '2026-11-13',
    examNotes:
      'Scritto con 2–3 esercizi (materiale ammesso), almeno 18 per l’orale. Orale con un argomento a scelta presentato con slide e uno estratto.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  {
    id: 'calcolo',
    name: 'Calcolo per l’Astronomia',
    degree: 'Laurea in Astronomia',
    examDate: '2026-11-17',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  {
    id: 'anelli',
    name: 'Anelli e Campi',
    degree: 'Laurea in Matematica',
    examDate: '2027-02',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  {
    id: 'topalg',
    name: 'Topologia Algebrica',
    code: '06327',
    degree: 'Laurea in Matematica',
    examDate: '2027-02',
    examNotes: 'Orale, con gli esercizi del corso.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  {
    id: 'astrost',
    name: 'Astrofisica Stellare',
    code: '27217',
    degree: 'Laurea in Astronomia',
    examDate: '2027-02',
    examNotes: 'Scritto propedeutico di 10 problemi; il voto viene solo dall’orale.',
    sections: [],
    difficulty: 2,
    semester: 1,
    updatedAt: 0,
  },
  { id: 'tdn', name: 'Teoria dei Numeri', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
  { id: 'geoproj', name: 'Geometria Proiettiva', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
  { id: 'compan', name: 'Complementi di Analisi', sections: [], difficulty: 2, semester: 2, updatedAt: 0 },
]

export const SEED_DEADLINES: Deadline[] = [
  // Le date del tirocinio si inseriscono nella pagina Dati.
  { id: 'tirocinio', title: 'Tirocinio alle Maldive', kind: 'periodo', updatedAt: 0 },
  { id: 'laurea', title: 'Laurea', kind: 'laurea', date: '2027-07', notes: 'Obiettivo media ≥ 28', updatedAt: 0 },
]

export const SEED_SETTINGS: Setting[] = [
  { id: 'newCardsPerDay', value: 15, updatedAt: 0 },
  { id: 'targetAverage', value: 28, updatedAt: 0 },
]

export function seedRules(): RuleConfig[] {
  return RULES.map((r) => ({ id: r.id, enabled: true, thresholds: defaultThresholds(r.id), updatedAt: 0 }))
}

/** Aggiunge i record del seed che mancano, senza toccare quelli esistenti. */
export async function ensureSeed(db: OrbitaDB): Promise<void> {
  await db.transaction('rw', [db.courses, db.deadlines, db.rules, db.settings], async () => {
    const version = await db.settings.get('seedVersion')
    if (typeof version?.value === 'number' && version.value >= SEED_VERSION) return

    const addMissing = async (name: 'courses' | 'deadlines' | 'rules' | 'settings', rows: { id: string }[]) => {
      const table = db.table(name)
      const existing = await table.bulkGet(rows.map((r) => r.id))
      const missing = rows.filter((_, i) => !existing[i])
      if (missing.length) await table.bulkAdd(missing)
    }

    await addMissing('courses', SEED_COURSES)
    await addMissing('deadlines', SEED_DEADLINES)
    await addMissing('rules', seedRules())
    await addMissing('settings', SEED_SETTINGS)
    await db.settings.put({ id: 'seedVersion', value: SEED_VERSION, updatedAt: 0 })
  })
}
