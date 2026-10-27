// I cinque stati di accrescimento del buco nero del giorno (SPEC §2).
// Le opacità vengono dalla tabella del mockup Copertina-BucoNero.

export type Energy = 1 | 2 | 3 | 4 | 5

export interface EnergyState {
  level: Energy
  name: string
  word: string
  color: string
  disk: number
  glow: number
  ring: number
  jet: number
}

export const ENERGY: Record<Energy, EnergyState> = {
  1: { level: 1, name: 'Sgr A*', word: 'a riposo', color: '#E2604A', disk: 0.32, glow: 0.22, ring: 0.45, jet: 0 },
  2: { level: 2, name: 'LINER', word: 'fiacco', color: '#FF9757', disk: 0.55, glow: 0.34, ring: 0.6, jet: 0 },
  3: { level: 3, name: 'Seyfert', word: 'regolare', color: '#FFCF6E', disk: 0.82, glow: 0.48, ring: 0.8, jet: 0 },
  4: { level: 4, name: 'Quasar', word: 'carico', color: '#EAF0FF', disk: 1, glow: 0.66, ring: 0.95, jet: 0.35 },
  5: { level: 5, name: 'Blazar', word: 'al massimo', color: '#8DB2FF', disk: 1, glow: 0.85, ring: 1, jet: 1 },
}

export const ENERGY_LEVELS: Energy[] = [1, 2, 3, 4, 5]

/** Livello mostrato quando oggi non è ancora stato scelto. */
export const DEFAULT_ENERGY: Energy = 3

export function isEnergy(value: unknown): value is Energy {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}
