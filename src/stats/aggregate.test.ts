import { describe, expect, it } from 'vitest'
import type { DayRecord, Session, TypingRun, Weight, Workout } from '../db/schema'
import { SEED_COURSES } from '../db/seed'
import {
  averageFor,
  dailyHours,
  elsaDays,
  energyVsHours,
  hoursBySubject,
  kpis,
  periodRange,
  typingDays,
  weightTrend,
  workoutRows,
} from './aggregate'

const TODAY = '2026-10-28'
let n = 0
const s = (date: string, minutes: number, type: Session['type'], extra: Partial<Session> = {}): Session => ({ id: `s${++n}`, date, minutes, type, updatedAt: 1, ...extra })

const TYPE_LABEL: Record<Session['type'], string> = {
  studio: 'Studio senza corso',
  ripasso: 'Ripasso senza corso',
  lavoro: 'Ripetizioni',
  lean: 'Lean 4',
  inglese: 'Inglese',
  lettura: 'Lettura',
  dattilografia: 'Dattilografia',
}

describe('periodi', () => {
  it('7 e 14 giorni fino a oggi compreso', () => {
    expect(periodRange('7', TODAY)).toMatchObject({ from: '2026-10-22', to: TODAY })
    expect(periodRange('14', TODAY).days).toHaveLength(14)
  })

  it('da settembre dell’anno accademico', () => {
    expect(periodRange('settembre', TODAY).from).toBe('2026-09-01')
    expect(periodRange('settembre', '2027-02-10').from).toBe('2026-09-01')
    expect(periodRange('settembre', '2026-09-01').days).toEqual(['2026-09-01'])
  })
})

describe('ore', () => {
  const sessions = [s(TODAY, 120, 'studio', { courseId: 'sdm' }), s(TODAY, 30, 'ripasso', { courseId: 'sdm' }), s(TODAY, 90, 'lavoro'), s(TODAY, 60, 'lean'), s('2026-10-27', 60, 'studio'), { ...s(TODAY, 600, 'studio'), deletedAt: 9 }]

  it('somma studio e lavoro per giorno, giorni vuoti compresi', () => {
    const days = dailyHours(sessions, ['2026-10-26', '2026-10-27', TODAY])
    expect(days.map((d) => d.total)).toEqual([0, 1, 4])
    expect(days[2]).toMatchObject({ study: 2.5, work: 1.5 })
  })

  it('ripartisce le ore per corso e per tipo', () => {
    const rows = hoursBySubject(sessions, SEED_COURSES, periodRange('7', TODAY), (ty) => TYPE_LABEL[ty])
    expect(rows.map((r) => [r.label, r.hours])).toEqual([
      ['Struttura della Materia', 2.5],
      ['Ripetizioni', 1.5],
      ['Lean 4', 1],
      ['Studio senza corso', 1],
    ])
  })
})

describe('sport e peso', () => {
  it('conta gli allenamenti del periodo per tipo', () => {
    const w: Workout[] = [
      { id: 'a', date: TODAY, type: 'arrampicata', minutes: 120, updatedAt: 1 },
      { id: 'b', date: '2026-10-20', type: 'arrampicata', minutes: 90, updatedAt: 1 },
      { id: 'c', date: '2026-10-26', type: 'corsa', minutes: 40, updatedAt: 1 },
    ]
    const rows = workoutRows(w, periodRange('7', TODAY))
    expect(rows.map((r) => [r.type, r.count])).toEqual([
      ['arrampicata', 1],
      ['corsa', 1],
      ['palestra', 0],
    ])
  })

  it('tiene l’ultima pesata del giorno e stima la tendenza settimanale', () => {
    const weights: Weight[] = [
      { id: '1', date: '2026-10-15', kg: 74, updatedAt: 1 },
      { id: '2', date: '2026-10-22', kg: 73.5, updatedAt: 1 },
      { id: '3', date: '2026-10-22', kg: 73.3, updatedAt: 2 },
      { id: '4', date: '2026-10-29', kg: 72.6, updatedAt: 1 },
    ]
    const t = weightTrend(weights, periodRange('14', TODAY))
    expect(t.points.map((p) => p.kg)).toEqual([74, 73.3])
    expect(t.perWeek).toBeCloseTo(-0.7, 5)
    const single = weightTrend(weights.slice(0, 1), periodRange('14', TODAY))
    expect(single.points).toEqual([{ date: '2026-10-15', kg: 74 }])
    expect(single.perWeek).toBeUndefined()
  })
})

describe('dattilografia ed ELSA', () => {
  it('fa la media del giorno', () => {
    const runs: TypingRun[] = [30, 34].map((wpm, i) => ({ id: String(i), date: TODAY, at: i, lesson: 'base', wpm, accuracy: 0.9 + i * 0.04, chars: 100, keyErrors: {}, keyHits: {}, updatedAt: 1 }))
    expect(typingDays(runs, periodRange('7', TODAY))).toEqual([{ date: TODAY, wpm: 32, accuracy: 0.92, runs: 2 }])
  })

  it('somma i minuti di ELSA e tiene l’ultimo punteggio', () => {
    const days = elsaDays([s(TODAY, 15, 'inglese', { score: 70, start: '8:00' }), s(TODAY, 10, 'inglese', { score: 74, start: '21:00' })], ['2026-10-27', TODAY])
    expect(days).toEqual([
      { date: '2026-10-27', minutes: 0 },
      { date: TODAY, minutes: 25, score: 74 },
    ])
  })
})

describe('energia e ore', () => {
  it('fa la media delle ore per stato del buco nero', () => {
    const days: DayRecord[] = [
      { id: '2026-10-26', date: '2026-10-26', energy: 5, updatedAt: 1 },
      { id: '2026-10-27', date: '2026-10-27', energy: 5, updatedAt: 1 },
      { id: TODAY, date: TODAY, energy: 1, updatedAt: 1 },
    ]
    const sessions = [s('2026-10-26', 480, 'studio'), s('2026-10-27', 360, 'studio'), s(TODAY, 120, 'lavoro')]
    const rows = energyVsHours(days, sessions, periodRange('7', TODAY))
    expect(rows.find((r) => r.energy === 5)).toMatchObject({ days: 2, average: 7 })
    expect(rows.find((r) => r.energy === 3)).toMatchObject({ days: 0, average: 0 })
    expect(averageFor(rows, [4, 5])).toBe(7)
    expect(averageFor(rows, [1, 2])).toBe(2)
    expect(averageFor(rows, [3])).toBeUndefined()
  })
})

describe('numeri in testa', () => {
  it('ore della settimana, media del periodo, arrampicate del mese', () => {
    const sessions = [s(TODAY, 480, 'studio'), s('2026-10-20', 480, 'studio')]
    const workouts: Workout[] = [
      { id: 'a', date: '2026-10-05', type: 'arrampicata', minutes: 90, updatedAt: 1 },
      { id: 'b', date: '2026-09-30', type: 'arrampicata', minutes: 90, updatedAt: 1 },
    ]
    const k = kpis(sessions, workouts, [], periodRange('14', TODAY), TODAY, 8, 3)
    expect(k).toMatchObject({ hours7: 8, target7: 56, climbsMonth: 1, climbsMonthTarget: 12 })
    expect(k.averagePerDay).toBeCloseTo(16 / 14)
  })
})
