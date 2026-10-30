// Scritture comuni, tutte con updatedAt e cancellazione logica.

import type { ISODate } from '../lib/dates'
import type { Energy } from '../lib/energy'
import { db } from './db'
import { save } from './repo'
import type { DayRecord, Session, SessionType, Weight, Workout, WorkoutType } from './schema'

export async function setEnergy(date: ISODate, energy: Energy): Promise<void> {
  const current = await db.days.get(date)
  await save<DayRecord>(db.days, { ...current, id: date, date, energy, deletedAt: undefined })
}

export function logSession(entry: {
  date: ISODate
  type: SessionType
  minutes: number
  start?: string
  courseId?: string
  score?: number
  notes?: string
  planned?: number
}): Promise<Session> {
  return save<Session>(db.sessions, entry)
}

export function logWorkout(entry: { date: ISODate; type: WorkoutType; minutes: number; start?: string; notes?: string }): Promise<Workout> {
  return save<Workout>(db.workouts, entry)
}

export function logWeight(date: ISODate, kg: number): Promise<Weight> {
  return save<Weight>(db.weights, { date, kg })
}
