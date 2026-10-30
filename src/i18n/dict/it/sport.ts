import type { WorkoutType } from '../../../db/schema'

const label: Record<WorkoutType, string> = { arrampicata: 'Arrampicata', corsa: 'Corsa', palestra: 'Palestra' }
const lower: Record<WorkoutType, string> = { arrampicata: 'arrampicata', corsa: 'corsa', palestra: 'palestra' }

export const sport = { label, lower }
