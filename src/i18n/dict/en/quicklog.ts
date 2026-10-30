import type { Format } from '../../format/types'
import { legacy } from './legacy'

export type QuickKind = 'studio' | 'lavoro' | 'arrampicata' | 'corsa' | 'palestra' | 'peso' | 'lean' | 'elsa' | 'lettura'

const kind: Record<QuickKind, string> = {
  studio: 'Study',
  lavoro: 'Work',
  arrampicata: 'Climbing',
  corsa: 'Running',
  palestra: 'Gym',
  peso: 'Weight',
  lean: legacy.lean,
  elsa: legacy.elsa,
  lettura: 'Reading',
}

export const quicklog = {
  title: 'Log',
  submit: 'Log',
  groupLabel: 'What are you logging',
  kind,
  weight: 'Kilograms',
  minutes: 'Minutes',
  course: 'Course',
  score: 'Score',
  day: 'Day',
  weightPlaceholder: '72.5',
  scorePlaceholder: '0–100',
  errWeight: 'Enter your weight in kilograms, for example 72.5.',
  errMinutes: 'Enter how many minutes, from 1 to 1440.',
  errScore: `The ${legacy.elsa} score goes from 0 to 100.`,
  errSave: 'I couldn’t save that. Try again.',
  weightLogged: (p: { kg: number }, f: Format) => `Weight logged: ${f.number(p.kg, 3)} kg.`,
  logged: (p: { minutes: number; kind: QuickKind }, f: Format) =>
    `Logged ${f.minutes(p.minutes)} of ${p.kind === 'elsa' ? legacy.elsa : kind[p.kind].toLowerCase()}.`,
}
