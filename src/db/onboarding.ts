import { useLiveQuery } from 'dexie-react-hooks'
import { db, type OrbitaDB } from './db'
import { useProfile } from './hooks'
import type { Profile } from './profile'
import type { TableName } from './schema'

export type OnboardingState = 'loading' | 'ready' | 'complete-profile' | 'wizard'

/**
 * profile: undefined = in caricamento, null = nessuna riga. hasData: undefined = in caricamento.
 * Le righe si valutano dall'alto, vince la prima che corrisponde.
 */
export function onboardingState(profile: Profile | null | undefined, hasData: boolean | undefined): OnboardingState {
  if (profile === undefined || hasData === undefined) return 'loading'
  if (profile && typeof profile.completedAt === 'number' && Number.isFinite(profile.completedAt) && profile.completedAt > 0) return 'ready'
  if (profile) return 'complete-profile'
  return hasData ? 'complete-profile' : 'wizard'
}

/** Tabelle dei dati dell'utente: non le impostazioni né le regole, che scrivono anche il percorso guidato e il seed. */
const DATA_TABLES: TableName[] = ['courses', 'sessions', 'workouts', 'weights', 'events', 'tasks', 'deadlines', 'cards', 'days', 'typingRuns']

/** Vero se esiste almeno una riga non cancellata in una delle tabelle dei dati. */
export async function hasUserData(database: OrbitaDB): Promise<boolean> {
  for (const name of DATA_TABLES) {
    const found = await database.table(name).filter((r: { deletedAt?: number }) => !r.deletedAt).first()
    if (found) return true
  }
  return false
}

export function useOnboarding(): OnboardingState {
  const profile = useProfile()
  const hasData = useLiveQuery(() => hasUserData(db), [])
  return onboardingState(profile, hasData)
}
