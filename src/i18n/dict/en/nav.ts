import type { RouteId } from '../../../app/router'
import type { Lang } from '../../lang'

const items: Record<RouteId, string> = {
  oggi: 'Today',
  agenda: 'Agenda',
  briefing: 'Briefing',
  libretto: 'Transcript',
  regole: 'Rules',
  multiverso: 'Multiverse',
  statistiche: 'Stats',
  ripasso: 'Review',
  dattilografia: 'Typing',
  mazzi: 'Decks',
  dati: 'Data',
}

/** Accessible name of the badge showing the day’s language. */
const langBadge: Record<Lang, string> = { it: 'Day in Italian', en: 'Day in English' }

export const nav = { sections: 'Sections', items, langBadge }
