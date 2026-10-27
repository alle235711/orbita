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

export type SessionType = 'studio' | 'lavoro' | 'lean' | 'ripasso' | 'dattilografia' | 'inglese' | 'lettura'
export type WorkoutType = 'arrampicata' | 'corsa' | 'palestra'
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
  /** Punteggio ELSA (sessioni di inglese). */
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
}

export type DeadlineKind = 'periodo' | 'laurea' | 'scadenza'

export interface Deadline extends Syncable {
  title: string
  kind: DeadlineKind
  date: string
  endDate?: string
  notes?: string
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
  /** Errori e tentativi per tasto (id del tasto della tastiera HP). */
  keyErrors: Record<string, number>
  keyHits: Record<string, number>
}

export type RuleId =
  | 'esame-vicino'
  | 'energia-bassa'
  | 'energia-media'
  | 'energia-alta'
  | 'sport'
  | 'lean'
  | 'ore-settimana'
  | 'schede-scadute'
  | 'tirocinio'

/** id = identificativo della regola. */
export interface RuleConfig extends Syncable {
  id: RuleId
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
]
