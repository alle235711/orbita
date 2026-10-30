import type { WorkoutType } from '../../../db/schema'

const label: Record<WorkoutType, string> = { arrampicata: 'Climbing', corsa: 'Running', palestra: 'Gym', nuoto: 'Swimming', altro: 'Other' }
const lower: Record<WorkoutType, string> = { arrampicata: 'climbing', corsa: 'running', palestra: 'gym', nuoto: 'swimming', altro: 'other' }

export const sport = { label, lower }
