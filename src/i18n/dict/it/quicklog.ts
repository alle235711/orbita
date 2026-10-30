import type { Format } from '../../format/types'
import type { QuickLogKind } from '../../../modules/registry'

const kind: Record<QuickLogKind, string> = {
  studio: 'Studio',
  lavoro: 'Lavoro',
  arrampicata: 'Arrampicata',
  corsa: 'Corsa',
  palestra: 'Palestra',
  nuoto: 'Nuoto',
  altro: 'Altro sport',
  peso: 'Peso',
  abilita: 'Abilità personale',
  lingua: 'Lingua straniera',
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
  errScore: 'Il punteggio va da 0 a 100.',
  errSave: 'Non sono riuscito a salvare. Riprova.',
  weightLogged: (p: { kg: number }, f: Format) => `Registrato il peso: ${f.number(p.kg, 3)} kg.`,
  /** `label` è già pronto: il nome scritto dall'utente o il tipo in minuscolo. */
  logged: (p: { minutes: number; label: string }, f: Format) => `Registrati ${f.minutes(p.minutes)} di ${p.label}.`,
}
