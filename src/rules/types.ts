import type { CalendarEvent, Course, Deadline, RuleConfig, RuleId, Session, SessionType, Workout, WorkoutType } from '../db/schema'
import type { ISODate } from '../lib/dates'
import type { Energy } from '../lib/energy'
import type { PlanMsg } from '../i18n/messages'
import type { Profile } from '../db/profile'
import type { ModulesSettings, StudyBlockSettings } from '../modules/types'

/** Tutto quello che serve al motore di regole, già caricato dal database. */
export interface RuleContext {
  today: ISODate
  /** Minuti dalla mezzanotte. */
  now: number
  /** Energia scelta oggi; se manca si ragiona come Seyfert. */
  energy?: Energy
  courses: Course[]
  deadlines: Deadline[]
  /** Impegni di oggi (e volendo dei giorni vicini). */
  events: CalendarEvent[]
  /** Sessioni degli ultimi 30 giorni circa, oggi compreso. */
  sessions: Session[]
  /** Allenamenti degli ultimi 14 giorni circa, oggi compreso. */
  workouts: Workout[]
  /** Schede di oggi per corso: scadute e nuove proposte. */
  cards: { due: Record<string, number>; fresh: Record<string, number> }
  /** Configurazione salvata; per le regole mancanti valgono i predefiniti. */
  rules: RuleConfig[]
  profile: Profile | null
  /** Già normalizzati. */
  modules: ModulesSettings
  studyBlock: StudyBlockSettings
}

export interface ResolvedRule {
  enabled: boolean
  t: Record<string, number>
}

export type Rules = Record<RuleId, ResolvedRule>

export type Tier = 'low' | 'mid' | 'high'

export type PlanKind = SessionType | WorkoutType | 'camminata'

export interface PlanItem {
  /** Stabile nella giornata: serve a confermare i blocchi in agenda. */
  key: string
  title: PlanMsg
  detail: PlanMsg
  /** Durata totale in minuti. */
  minutes: number
  blocks: { count: number; minutes: number; pause: number }
  /** Orario già fissato in agenda. */
  at?: string
  kind: PlanKind
  courseId?: string
  ruleId: RuleId
  /** Da fare nelle prime ore (regola 4). */
  morning?: boolean
  /** Meglio verso sera (sport, lettura). */
  evening?: boolean
}

export interface BriefingNote {
  ruleId: RuleId
  title: PlanMsg
  /** Il perché, in una frase. */
  text: PlanMsg
  level: 'info' | 'avviso'
}

export interface Priority {
  courseId: string
  name: string
  examDate: string
  days: number
  /** true se viene dalla regola 1 (esame entro la soglia). */
  fromRule: boolean
}

export interface HoursStatus {
  last7: number
  target7: number
  hoursPerDay: number
  tomorrow: number
}

export interface SportStatus {
  /** Solo i tipi attivi, nell'ordine di WORKOUT_ORDER. */
  types: { type: WorkoutType; done: number; target: number }[]
  deadline: number
}

export interface ActivePeriod {
  id: string
  name: string
  start: string
  end: string
}

export interface DayPlan {
  tier: Tier
  energy: Energy
  headline: [PlanMsg, PlanMsg]
  /** La frase della regola applicata, sotto il titolo della copertina. */
  rule: PlanMsg
  items: PlanItem[]
  tomorrow: PlanItem[]
  notes: BriefingNote[]
  priority?: Priority
  hours: HoursStatus
  sport: SportStatus
  /** Giorni dall'ultima sessione dell'abilità (Infinity se mai). */
  abilityGap: number
  /** Il periodo speciale in corso, se c'è. */
  period?: ActivePeriod
}
