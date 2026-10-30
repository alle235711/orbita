import type { Format } from '../../format/types'
import type { QuickLogKind } from '../../../modules/registry'

const kind: Record<QuickLogKind, string> = {
  studio: 'Study',
  lavoro: 'Work',
  arrampicata: 'Climbing',
  corsa: 'Running',
  palestra: 'Gym',
  nuoto: 'Swimming',
  altro: 'Other sport',
  peso: 'Weight',
  abilita: 'Personal skill',
  lingua: 'Foreign language',
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
  errScore: 'The score goes from 0 to 100.',
  errSave: 'I couldn’t save that. Try again.',
  weightLogged: (p: { kg: number }, f: Format) => `Weight logged: ${f.number(p.kg, 3)} kg.`,
  /** `label` is ready to show: the user's own name or the lower-case kind. */
  logged: (p: { minutes: number; label: string }, f: Format) => `Logged ${f.minutes(p.minutes)} of ${p.label}.`,
}
