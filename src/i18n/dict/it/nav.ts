import type { RouteId } from '../../../app/router'
import type { Lang } from '../../lang'

const items: Record<RouteId, string> = {
  oggi: 'Oggi',
  agenda: 'Agenda',
  briefing: 'Briefing',
  regole: 'Regole',
  statistiche: 'Statistiche',
  ripasso: 'Ripasso',
  dattilografia: 'Dattilografia',
  dati: 'Dati',
}

/** Nome accessibile del distintivo della lingua del giorno. */
const langBadge: Record<Lang, string> = { it: 'Giornata in italiano', en: 'Giornata in inglese' }

export const nav = { sections: 'Sezioni', items, langBadge }
