import type { RouteId } from '../../../app/router'
import type { Format } from '../../format/types'

const titles: Record<RouteId, string> = {
  oggi: 'Oggi',
  agenda: 'Agenda',
  briefing: 'Briefing',
  libretto: 'Libretto',
  regole: 'Regole',
  statistiche: 'Statistiche',
  ripasso: 'Ripasso',
  dattilografia: 'Dattilografia',
  dati: 'Dati',
}

export const app = {
  skip: 'Vai al contenuto',
  titles,
  update: {
    newVersion: 'C’è una nuova versione di Orbita.',
    offlineReady: 'Orbita ora funziona anche senza rete.',
    refresh: 'Aggiorna',
    later: 'Più tardi',
    ok: 'Va bene',
  },
  timerChip: (p: { title: string; elapsed: string }) => `${p.title}, in corso da ${p.elapsed}. Ferma e salva.`,
  timer: {
    tooShort: (p: { title: string }) => `${p.title}: meno di un minuto, non l’ho salvata.`,
    walkDone: (p: { minutes: number }, f: Format) => `Camminata di ${f.minutes(p.minutes)} finita.`,
    savedWorkout: (p: { minutes: number; title: string }, f: Format) => `Salvati ${f.minutes(p.minutes)} di ${p.title.toLowerCase()}.`,
    savedSession: (p: { minutes: number; title: string }, f: Format) => `Salvati ${f.minutes(p.minutes)}: ${p.title}.`,
  },
}
