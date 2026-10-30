import type { Format } from '../../format/types'
import { legacy } from './legacy'

export type QuickKind = 'studio' | 'lavoro' | 'arrampicata' | 'corsa' | 'palestra' | 'peso' | 'lean' | 'elsa' | 'lettura'

const kind: Record<QuickKind, string> = {
  studio: 'Studio',
  lavoro: 'Lavoro',
  arrampicata: 'Arrampicata',
  corsa: 'Corsa',
  palestra: 'Palestra',
  peso: 'Peso',
  lean: legacy.lean,
  elsa: legacy.elsa,
  lettura: 'Lettura',
}

export const quicklog = {
  title: 'Registra',
  submit: 'Registra',
  groupLabel: 'Cosa registri',
  kind,
  weight: 'Chilogrammi',
  minutes: 'Minuti',
  course: 'Corso',
  score: 'Punteggio',
  day: 'Giorno',
  weightPlaceholder: '72,5',
  scorePlaceholder: '0–100',
  errWeight: 'Scrivi il peso in chilogrammi, per esempio 72,5.',
  errMinutes: 'Scrivi quanti minuti, da 1 a 1440.',
  errScore: `Il punteggio ${legacy.elsa} va da 0 a 100.`,
  errSave: 'Non sono riuscito a salvare. Riprova.',
  weightLogged: (p: { kg: number }, f: Format) => `Registrato il peso: ${f.number(p.kg, 3)} kg.`,
  logged: (p: { minutes: number; kind: QuickKind }, f: Format) =>
    `Registrati ${f.minutes(p.minutes)} di ${p.kind === 'elsa' ? legacy.elsa : kind[p.kind].toLowerCase()}.`,
}
