// Modello dei dati (SPEC §7), pensato per la sincronizzazione della fase 2:
// ogni record ha un id stabile, `updatedAt` (ms) e `deletedAt` per le
// cancellazioni logiche. I record del seed hanno updatedAt = 0, così ogni
// modifica dell'utente vince quando si fondono backup o dispositivi.

import type { Energy } from '../lib/energy'
import type { ISODate } from '../lib/dates'

export interface Syncable {
  id: string
  updatedAt: number
  deletedAt?: number
}

export type SessionType = 'studio' | 'lavoro' | 'abilita' | 'ripasso' | 'dattilografia' | 'lingua' | 'lettura'
export type WorkoutType = 'arrampicata' | 'corsa' | 'palestra' | 'nuoto' | 'altro'
/** Ordine del piano e dell'interfaccia. */
export const WORKOUT_ORDER: readonly WorkoutType[] = ['arrampicata', 'palestra', 'corsa', 'nuoto', 'altro']
export type EventType = 'lezione' | 'studio' | 'lavoro' | 'sport' | 'esame' | 'altro'
export type ReviewMode = 'copia' | 'completa' | 'nome' | 'memoria'
export type LeitnerBox = 1 | 2 | 3 | 4 | 5

/** id = data del giorno ('YYYY-MM-DD'). */
export interface DayRecord extends Syncable {
  date: ISODate
  energy?: Energy
  notes?: string
}

export interface Session extends Syncable {
  date: ISODate
  /** 'HH:MM' */
  start?: string
  minutes: number
  type: SessionType
  courseId?: string
  notes?: string
  /** Minuti del blocco di studio previsto, se la sessione è partita dal timer del piano. */
  planned?: number
  /** Punteggio dell'app di lingua (0–100). */
  score?: number
}

export interface Workout extends Syncable {
  date: ISODate
  start?: string
  type: WorkoutType
  minutes: number
  notes?: string
}

export interface Weight extends Syncable {
  date: ISODate
  kg: number
}

export interface CalendarEvent extends Syncable {
  date: ISODate
  start: string
  end: string
  title: string
  type: EventType
  /** Nato da un blocco suggerito dal piano. */
  suggested: boolean
  confirmed: boolean
  courseId?: string
  /** Chiave della voce del piano da cui viene, per non riproporla. */
  planKey?: string
  /** Presente solo per gli eventi creati dall'importazione di un file .ics. */
  source?: 'ics'
  /** UID del VEVENT (la serie) da cui viene l'evento. */
  uid?: string
  /** Luogo (aula), testo libero. */
  location?: string
  /** L'utente ha modificato o tolto un evento importato: l'importazione non lo tocca più. */
  userEdited?: boolean
}

export interface Task extends Syncable {
  title: string
  due?: ISODate
  done: boolean
  doneAt?: number
}

export interface Course extends Syncable {
  name: string
  code?: string
  degree?: string
  /** 'YYYY-MM-DD' oppure 'YYYY-MM' se si conosce solo il mese. */
  examDate?: string
  examNotes?: string
  sections: string[]
  /** 1–3: serve alla regola 4 per scegliere la teoria più difficile. */
  difficulty: 1 | 2 | 3
  semester?: 1 | 2
  color?: string
  /** Crediti (CFU). Facoltativi: i dati vecchi e le righe da compilare non li hanno. */
  cfu?: number
  /** Id del mazzo d'esempio da cui vengono le schede del corso. */
  sampleDeck?: string
  /** Nasconde le lezioni (eventi 'lezione') del corso da agenda, copertina e pianificazione. */
  hideLessons?: boolean
}

export type DeadlineKind = 'periodo' | 'scadenza'

export interface Deadline extends Syncable {
  title: string
  kind: DeadlineKind
  /** 'YYYY-MM-DD' o 'YYYY-MM'; manca finché non la inserisci in Dati. */
  date?: string
  endDate?: string
  notes?: string
  /** Eccezioni del periodo (solo kind 'periodo'); se mancano vale il valore normale. */
  hoursPerDay?: number
  /** Obiettivo settimanale per tipo di sport durante il periodo (0 = non proporlo). */
  sport?: Partial<Record<WorkoutType, number>>
  /** Giorno ISO della settimana (1–7) entro cui chiudere gli obiettivi di sport. */
  deadlineDay?: number
}

export interface Card extends Syncable {
  courseId: string
  section: string
  kind: string
  title: string
  text: string
  key: string
  needsFix: boolean
  userEdited: boolean
  /** Lettura a parole delle formule del testo, per chi usa un lettore di schermo (la "letturaFormula" dei file). */
  formulaReading?: string
}

export type ResultOutcome = 'superato' | 'rifiutato' | 'non-superato'

/** Un tentativo a un esame. id = uuid. */
export interface ExamResult extends Syncable {
  courseId: string
  /** Data completa 'YYYY-MM-DD' del tentativo (mai solo il mese). */
  date: ISODate
  outcome: ResultOutcome
  /** Intero 18..30, solo con esito 'superato'. Assente su un superato = idoneità (CFU, nessun voto). */
  grade?: number
  /** Lode: ha senso solo con grade === 30. Assente = false. */
  lode?: boolean
}

/** Un appello (data possibile) di un esame. id = uuid. */
export interface Appello extends Syncable {
  courseId: string
  /** 'YYYY-MM-DD' (giorno reale) oppure 'YYYY-MM' (solo il mese). */
  date: string
  /** Tagliata, al massimo 80 caratteri, assente se vuota. */
  note?: string
}

/** Un futuro possibile. id = uuid. `name` '' = etichetta predefinita "Universo n". */
export interface Universe extends Syncable {
  name: string
  /** courseId -> appelloId scelto in questo universo. Le chiavi possono essere vecchie (si ignorano). */
  picks: Record<string, string>
  /** courseId -> voto atteso (finito, 18..30). Chiave assente = voto atteso predefinito. */
  grades: Record<string, number>
  /** Ordine di visualizzazione, intero crescente. */
  order: number
}

/** id = id della scheda. */
export interface CardState extends Syncable {
  box: LeitnerBox
  due: ISODate
  firstReviewed: ISODate
  lastReviewed: ISODate
}

export interface CardReview extends Syncable {
  cardId: string
  date: ISODate
  at: number
  mode: ReviewMode
  wpm: number
  /** Precisione (Copia, Completa) o somiglianza (Indovina, A memoria), 0–1. */
  score: number
  wrongChars: number
  ok: boolean
  boxAfter: LeitnerBox
  /** Ripassata prima della scadenza: non cambia scatola. */
  early: boolean
}

export interface TypingRun extends Syncable {
  date: ISODate
  at: number
  lesson: string
  wpm: number
  accuracy: number
  chars: number
  /** Errori e tentativi per tasto (id del tasto della tastiera). */
  keyErrors: Record<string, number>
  keyHits: Record<string, number>
}

export type RuleId =
  | 'esame-vicino'
  | 'energia-bassa'
  | 'energia-media'
  | 'energia-alta'
  | 'sport'
  | 'abilita'
  | 'ore-settimana'
  | 'schede-scadute'
  | 'periodo'
/** Gruppi di soglie generali, salvati nella tabella delle regole. */
export type GroupId = 'giornata' | 'storico' | 'ripasso' | 'dattilografia' | 'registra'
export type ConfigId = RuleId | GroupId

/** id = identificativo della regola o del gruppo. */
export interface RuleConfig extends Syncable {
  id: ConfigId
  enabled: boolean
  thresholds: Record<string, number>
}

/** id = nome dell'impostazione. */
export interface Setting extends Syncable {
  value: unknown
}

export interface Tables {
  days: DayRecord
  sessions: Session
  workouts: Workout
  weights: Weight
  events: CalendarEvent
  tasks: Task
  courses: Course
  deadlines: Deadline
  cards: Card
  cardState: CardState
  cardReviews: CardReview
  typingRuns: TypingRun
  rules: RuleConfig
  settings: Setting
  results: ExamResult
  appelli: Appello
  universes: Universe
}

export type TableName = keyof Tables

export const TABLE_NAMES: TableName[] = [
  'days',
  'sessions',
  'workouts',
  'weights',
  'events',
  'tasks',
  'courses',
  'deadlines',
  'cards',
  'cardState',
  'cardReviews',
  'typingRuns',
  'rules',
  'settings',
  'results',
  'appelli',
  'universes',
]
