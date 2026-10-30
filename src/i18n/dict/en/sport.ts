import type { WorkoutType } from '../../../db/schema'

const label: Record<WorkoutType, string> = { arrampicata: 'Climbing', corsa: 'Running', palestra: 'Gym' }
const lower: Record<WorkoutType, string> = { arrampicata: 'climbing', corsa: 'running', palestra: 'gym' }

export const sport = { label, lower }
