import type { RouteId } from '../../../app/router'
import type { Format } from '../../format/types'

const titles: Record<RouteId, string> = {
  oggi: 'Today',
  agenda: 'Agenda',
  briefing: 'Briefing',
  regole: 'Rules',
  statistiche: 'Stats',
  ripasso: 'Review',
  dattilografia: 'Typing',
  dati: 'Data',
}

export const app = {
  skip: 'Skip to content',
  titles,
  update: {
    newVersion: 'There’s a new version of Orbita.',
    offlineReady: 'Orbita now works without a connection too.',
    refresh: 'Update',
    later: 'Later',
    ok: 'Got it',
  },
  timerChip: (p: { title: string; elapsed: string }) => `${p.title}, running for ${p.elapsed}. Stop and save.`,
  timer: {
    tooShort: (p: { title: string }) => `${p.title}: under a minute, so I didn’t save it.`,
    walkDone: (p: { minutes: number }, f: Format) => `${f.minutes(p.minutes)} walk finished.`,
    savedWorkout: (p: { minutes: number; title: string }, f: Format) => `Saved ${f.minutes(p.minutes)} of ${p.title.toLowerCase()}.`,
    savedSession: (p: { minutes: number; title: string }, f: Format) => `Saved ${f.minutes(p.minutes)}: ${p.title}.`,
  },
}
