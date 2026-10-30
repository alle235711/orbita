// Aggregazioni per le Statistiche (SPEC §3.4), tutte pure: ricevono i
// record e un intervallo di giorni, restituiscono serie pronte da disegnare.

import { WORKOUT_ORDER, type Course, type DayRecord, type Session, type SessionType, type TypingRun, type Weight, type Workout, type WorkoutType } from '../db/schema'
import { addDays, diffDays, isBetween, rangeDays, toMinutes, type ISODate } from '../lib/dates'
import { ENERGY_LEVELS, type Energy } from '../lib/energy'

export type Period = '7' | '14' | 'anno'

export interface Range {
  from: ISODate
  to: ISODate
  days: ISODate[]
}

/**
 * 7 o 14 giorni fino a oggi compreso, oppure dall'inizio dell'anno accademico:
 * l'ultima occorrenza di `yearStart` ('MM-DD') non successiva a oggi.
 */
export function periodRange(period: Period, today: ISODate, yearStart = '09-01'): Range {
  let from: ISODate
  if (period === 'anno') {
    const [y] = today.split('-').map(Number) as [number]
    const thisYear = `${y}-${/^\d{2}-\d{2}$/.test(yearStart) ? yearStart : '09-01'}`
    from = thisYear <= today ? thisYear : `${y - 1}-${thisYear.slice(5)}`
  } else {
    from = addDays(today, -(Number(period) - 1))
  }
  return { from, to: today, days: rangeDays(from, today) }
}

const live = <T extends { deletedAt?: number }>(rows: T[]) => rows.filter((r) => !r.deletedAt)

export interface DayHours {
  date: ISODate
  study: number
  work: number
  total: number
}

const ALL_WORK_TYPES: readonly SessionType[] = ['studio', 'ripasso', 'lavoro']

/** Ore al giorno, studio (con il ripasso) e lavoro insieme; `workTypes` dice quali tipi contano. */
export function dailyHours(sessions: Session[], days: ISODate[], workTypes: readonly SessionType[] = ALL_WORK_TYPES): DayHours[] {
  const map = new Map(days.map((d) => [d, { date: d, study: 0, work: 0, total: 0 }]))
  for (const s of live(sessions)) {
    const row = map.get(s.date)
    if (!row) continue
    if (!workTypes.includes(s.type)) continue
    if (s.type === 'studio' || s.type === 'ripasso') row.study += s.minutes / 60
    else if (s.type === 'lavoro') row.work += s.minutes / 60
    else continue
    row.total = row.study + row.work
  }
  return [...map.values()]
}

export interface SubjectHours {
  id: string
  label: string
  hours: number
  courseId?: string
}

/** Dove sono andate le ore: per corso lo studio e il ripasso, il resto per tipo. */
export function hoursBySubject(
  sessions: Session[],
  courses: Course[],
  range: Range,
  typeLabel: (type: SessionType) => string,
  typeEnabled: (type: SessionType) => boolean = () => true,
): SubjectHours[] {
  const names = new Map(courses.map((c) => [c.id, c.name]))
  const map = new Map<string, SubjectHours>()
  for (const s of live(sessions)) {
    if (!isBetween(s.date, range.from, range.to) || !typeEnabled(s.type)) continue
    const byCourse = (s.type === 'studio' || s.type === 'ripasso') && s.courseId && names.has(s.courseId)
    const id = byCourse ? `corso:${s.courseId}` : `tipo:${s.type}`
    const row = map.get(id) ?? { id, label: byCourse ? names.get(s.courseId!)! : typeLabel(s.type), hours: 0, courseId: byCourse ? s.courseId : undefined }
    row.hours += s.minutes / 60
    map.set(id, row)
  }
  return [...map.values()].filter((r) => r.hours > 0).sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label, 'it'))
}

export interface WorkoutRow {
  type: WorkoutType
  dates: ISODate[]
  count: number
  minutes: number
}

/** Una riga per ognuno dei tipi dati (di base tutti, nell'ordine del piano). */
export function workoutRows(workouts: Workout[], range: Range, types: readonly WorkoutType[] = WORKOUT_ORDER): WorkoutRow[] {
  return types.map((type) => {
    const list = live(workouts).filter((w) => w.type === type && isBetween(w.date, range.from, range.to))
    return { type, dates: list.map((w) => w.date).sort(), count: list.length, minutes: list.reduce((n, w) => n + w.minutes, 0) }
  })
}

export interface WeightPoint {
  date: ISODate
  kg: number
}

export interface WeightTrend {
  points: WeightPoint[]
  /** Variazione stimata in kg a settimana (retta dei minimi quadrati), se ci sono almeno due giorni. */
  perWeek?: number
  last?: WeightPoint
}

/** Il peso: una misura al giorno (l'ultima), e la tendenza. */
export function weightTrend(weights: Weight[], range: Range): WeightTrend {
  const byDay = new Map<ISODate, Weight>()
  for (const w of live(weights)) {
    if (!isBetween(w.date, range.from, range.to)) continue
    const prev = byDay.get(w.date)
    if (!prev || w.updatedAt > prev.updatedAt) byDay.set(w.date, w)
  }
  const points = [...byDay.values()].map((w) => ({ date: w.date, kg: w.kg })).sort((a, b) => a.date.localeCompare(b.date))
  if (points.length < 2) return { points, last: points.at(-1) }
  const xs = points.map((p) => diffDays(range.from, p.date))
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = points.reduce((a, p) => a + p.kg, 0) / points.length
  let num = 0
  let den = 0
  xs.forEach((x, i) => {
    num += (x - mx) * (points[i]!.kg - my)
    den += (x - mx) ** 2
  })
  return { points, perWeek: den ? (num / den) * 7 : 0, last: points.at(-1) }
}

export interface TypingDay {
  date: ISODate
  wpm: number
  accuracy: number
  runs: number
}

/** Dattilografia: media del giorno di parole al minuto e precisione. */
export function typingDays(runs: TypingRun[], range: Range): TypingDay[] {
  const map = new Map<ISODate, TypingRun[]>()
  for (const r of live(runs)) if (isBetween(r.date, range.from, range.to)) map.set(r.date, [...(map.get(r.date) ?? []), r])
  return [...map.entries()]
    .map(([date, list]) => ({
      date,
      wpm: list.reduce((n, r) => n + r.wpm, 0) / list.length,
      accuracy: list.reduce((n, r) => n + r.accuracy, 0) / list.length,
      runs: list.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export interface LanguageDay {
  date: ISODate
  minutes: number
  score?: number
}

/** Lingua: minuti al giorno e ultimo punteggio del giorno. */
export function languageDays(sessions: Session[], days: ISODate[]): LanguageDay[] {
  const map = new Map<ISODate, LanguageDay & { at: number }>(days.map((d) => [d, { date: d, minutes: 0, at: -1 }]))
  for (const s of live(sessions)) {
    if (s.type !== 'lingua') continue
    const row = map.get(s.date)
    if (!row) continue
    row.minutes += s.minutes
    const at = s.start ? toMinutes(s.start) : 0
    if (typeof s.score === 'number' && at >= row.at) {
      row.score = s.score
      row.at = at
    }
  }
  return [...map.values()].map(({ at: _at, ...rest }) => rest)
}

export interface EnergyHours {
  energy: Energy
  days: number
  /** Ore medie di studio e lavoro nei giorni con quell'energia. */
  average: number
}

export function energyVsHours(dayRecords: DayRecord[], sessions: Session[], range: Range, workTypes?: readonly SessionType[]): EnergyHours[] {
  const hours = new Map(dailyHours(sessions, range.days, workTypes).map((d) => [d.date, d.total]))
  return ENERGY_LEVELS.map((energy) => {
    const days = live(dayRecords).filter((d) => d.energy === energy && hours.has(d.date))
    const total = days.reduce((n, d) => n + (hours.get(d.date) ?? 0), 0)
    return { energy, days: days.length, average: days.length ? total / days.length : 0 }
  })
}

/** Media delle ore per un gruppo di livelli (per la frase "da Quasar e Blazar fai in media…"). */
export function averageFor(rows: EnergyHours[], levels: Energy[]): number | undefined {
  const sel = rows.filter((r) => levels.includes(r.energy) && r.days > 0)
  const days = sel.reduce((n, r) => n + r.days, 0)
  return days ? sel.reduce((n, r) => n + r.average * r.days, 0) / days : undefined
}

export interface PrimarySport {
  type: WorkoutType
  /** Obiettivo a settimana. */
  target: number
}

/** Il primo tipo di sport attivo, nell'ordine del piano, con un obiettivo maggiore di zero. */
export function primarySport(types: readonly { type: WorkoutType; target: number }[]): PrimarySport | undefined {
  for (const t of WORKOUT_ORDER) {
    const found = types.find((x) => x.type === t && x.target > 0)
    if (found) return { type: found.type, target: found.target }
  }
  return undefined
}

export interface Kpis {
  hours7: number
  target7: number
  averagePerDay: number
  /** Sessioni del mese del tipo di sport principale (mancano se non ce n'è uno). */
  sportMonth?: number
  sportMonthTarget?: number
  sportType?: WorkoutType
  lastWpm?: number
}

export function kpis(
  sessions: Session[],
  workouts: Workout[],
  runs: TypingRun[],
  range: Range,
  today: ISODate,
  hoursPerDay: number,
  sport?: PrimarySport,
  workTypes?: readonly SessionType[],
): Kpis {
  const last7 = dailyHours(sessions, rangeDays(addDays(today, -6), today), workTypes)
  const inPeriod = dailyHours(sessions, range.days, workTypes)
  const month = today.slice(0, 7)
  const daysInMonthSoFar = Number(today.slice(8, 10))
  const lastRun = live(runs).sort((a, b) => b.at - a.at)[0]
  return {
    hours7: last7.reduce((n, d) => n + d.total, 0),
    target7: hoursPerDay * 7,
    averagePerDay: inPeriod.length ? inPeriod.reduce((n, d) => n + d.total, 0) / inPeriod.length : 0,
    ...(sport
      ? {
          sportType: sport.type,
          sportMonth: live(workouts).filter((w) => w.type === sport.type && w.date.startsWith(month) && w.date <= today).length,
          sportMonthTarget: Math.round((sport.target * daysInMonthSoFar) / 7),
        }
      : {}),
    lastWpm: lastRun?.wpm,
  }
}
