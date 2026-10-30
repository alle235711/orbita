import type { Energy } from '../../../lib/energy'
import { ENERGY } from '../../../lib/energy'
import { isMonthOnly } from '../../../lib/dates'
import type { Format } from '../../format/types'
import { capitalize } from '../../format/util'
import { legacy } from './legacy'

export const briefing = {
  /** Perché quella materia oggi. `hours` = ore dedicate alla priorità negli ultimi 7 giorni. */
  priorityReason: (p: { days: number; date: string; hours: number }, f: Format) =>
    `È l’esame più vicino: ${f.relativeDays(p.days)}, ${f.on(p.date)}.` +
    (p.hours > 0 ? ` Negli ultimi 7 giorni ci hai dedicato ${f.hours(p.hours)}.` : ' Negli ultimi 7 giorni non ci hai ancora lavorato.'),

  title: 'Briefing',
  computedAt: (p: { date: string; time: string }, f: Format) =>
    `${capitalize(f.dateLong(p.date))}, calcolato alle ${p.time} su questo dispositivo, senza rete.`,
  disk: (p: { energy: Energy }) => ` Disco da ${ENERGY[p.energy].name}.`,

  priorityLead: 'Oggi la priorità è',
  noPriority: 'Nessun esame sotto la soglia',
  noPriorityText: 'Il piano segue l’esame più vicino e l’energia di oggi.',
  goToPlan: 'Vai al piano',

  toGraduation: 'Verso la laurea',
  /** `end` presente = periodo; altrimenti data singola (o solo mese). */
  when: (p: { date: string; end?: string; days: number }, f: Format) =>
    p.end
      ? `${f.from(p.date)} ${f.to(p.end)}`
      : isMonthOnly(p.date)
        ? f.date(p.date)
        : `${f.date(p.date)}, ${f.relativeDays(p.days)}`,

  week: 'La settimana',
  hoursLast7: 'Ore negli ultimi 7 giorni',
  hoursOf: (p: { target: number }, f: Format) => `di ${f.hours(p.target)}`,
  hoursDeficit: (p: { deficit: number; perDay: number; tomorrow: number }, f: Format) =>
    `${f.hours(p.deficit)} sotto il ritmo di ${f.hours(p.perDay)} al giorno: domani l’obiettivo è ${f.hours(p.tomorrow)}.`,
  hoursOnPace: 'In pari con il ritmo della settimana.',

  sport: 'Sport',
  sportSummary: (p: { main: 'arrampicata' | 'palestra'; runsDone: number; runsTarget: number }) =>
    `${p.main === 'arrampicata' ? 'arrampicate' : 'palestra'}, ${p.runsDone}/${p.runsTarget} corse`,
  sportGoalsReached: 'Obiettivi della settimana raggiunti.',

  abilityTitle: legacy.leanItem,
  abilityToday: 'Oggi',
  abilityNever: 'Mai',
  abilityDays: (p: { n: number }) => `${p.n} g`,
  abilityDone: 'già fatto',
  abilitySince: 'dall’ultima sessione',
  abilityWithin: 'Dentro la soglia.',

  englishTitle: `Inglese con ${legacy.elsa}`,
  streak: (p: { n: number }) => `${p.n} g`,
  streakSuffix: 'di fila',
  englishDetail: (p: { minutes: number; lastScore?: number; change?: number }, f: Format) =>
    `${f.count(p.minutes, 'minuto', 'minuti')} questa settimana` +
    (p.lastScore !== undefined ? `, ultimo punteggio ${p.lastScore}` : '') +
    (p.change ? ` (${p.change > 0 ? '+' : ''}${p.change} in due settimane)` : '') +
    '.',

  typingTitle: 'Dattilografia',
  wpm: 'parole al minuto',
  typingNone: 'Nessuna prova ancora: la prima lezione è la riga di base.',
  typingRecord: (p: { best: number; daysSinceBest?: number; runs: number }, f: Format) =>
    `Record ${p.best}${p.daysSinceBest ? `, fermo da ${f.count(p.daysSinceBest, 'giorno', 'giorni')}` : ', appena battuto'}. ${f.count(p.runs, 'prova', 'prove')} in settimana.`,

  todayRules: 'Le regole di oggi',
  noRules: 'Nessuna regola è scattata oggi.',
  editRules: 'Modifica le regole',

  tomorrow: 'Domani',
  tomorrowGoal: (p: { hours: number }, f: Format) => `Obiettivo di ${f.hours(p.hours)}`,
  tomorrowPeriod: legacy.stillInPeriod,
  tomorrowNothing: 'Niente da aggiungere per ora: il piano di domani si calcola domattina.',
}
