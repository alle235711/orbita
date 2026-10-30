import type { WorkoutType } from '../../../db/schema'

const label: Record<WorkoutType, string> = { arrampicata: 'Arrampicata', corsa: 'Corsa', palestra: 'Palestra', nuoto: 'Nuoto', altro: 'Altro' }
const lower: Record<WorkoutType, string> = { arrampicata: 'arrampicata', corsa: 'corsa', palestra: 'palestra', nuoto: 'nuoto', altro: 'altro' }

export const sport = { label, lower }
