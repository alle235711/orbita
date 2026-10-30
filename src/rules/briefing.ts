// Il briefing del mattino (SPEC §3.3): calcolato sul dispositivo, senza rete,
// dallo stesso contesto delle regole.

import type { Session, TypingRun } from '../db/schema'
import type { I18n } from '../i18n'
import { addDays, diffDays, isBetween, type ISODate } from '../lib/dates'
import type { DayPlan, RuleContext } from './types'

export interface LanguageStatus {
  /** Giorni di fila con la lingua, fino a oggi (o fino a ieri se oggi manca ancora). */
  streak: number
  minutes7: number
  lastScore?: number
  /** Differenza tra l'ultimo punteggio e il primo della finestra dei punteggi. */
  scoreChange?: number
}

export interface TypingStatus {
  lastWpm?: number
  bestWpm?: number
  /** Giorni dall'ultimo miglioramento del record. */
  daysSinceBest?: number
  runs7: number
}

export interface WeekStatus {
  language: LanguageStatus
  typing: TypingStatus
}

export function languageStatus(sessions: Session[], today: ISODate, scoreDays = 14): LanguageStatus {
  const english = sessions.filter((s) => !s.deletedAt && s.type === 'lingua')
  const days = new Set(english.map((s) => s.date))
  let day = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  const minutes7 = english.filter((s) => isBetween(s.date, addDays(today, -6), today)).reduce((n, s) => n + s.minutes, 0)
  const scored = english
    .filter((s) => typeof s.score === 'number' && isBetween(s.date, addDays(today, -(scoreDays - 1)), today))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))
  const last = scored.at(-1)?.score
  const first = scored[0]?.score
  return { streak, minutes7, lastScore: last, scoreChange: last !== undefined && first !== undefined && scored.length > 1 ? last - first : undefined }
}

export function typingStatus(runs: TypingRun[], today: ISODate): TypingStatus {
  const sorted = runs.filter((r) => !r.deletedAt).sort((a, b) => a.at - b.at)
  if (!sorted.length) return { runs7: 0 }
  let best = -1
  let bestDate = sorted[0]!.date
  for (const r of sorted) {
    if (r.wpm > best) {
      best = r.wpm
      bestDate = r.date
    }
  }
  return {
    lastWpm: sorted.at(-1)!.wpm,
    bestWpm: best,
    daysSinceBest: diffDays(bestDate, today),
    runs7: sorted.filter((r) => isBetween(r.date, addDays(today, -6), today)).length,
  }
}

export function weekStatus(ctx: Pick<RuleContext, 'sessions' | 'today'>, runs: TypingRun[], scoreDays = 14): WeekStatus {
  return { language: languageStatus(ctx.sessions, ctx.today, scoreDays), typing: typingStatus(runs, ctx.today) }
}

/** La frase sulla priorità: perché quella materia oggi. */
export function priorityReason(plan: DayPlan, workedOnPriority7: number, i18n: Pick<I18n, 't' | 'f'>): string | undefined {
  const p = plan.priority
  if (!p) return undefined
  return i18n.t.briefing.priorityReason({ days: p.days, date: p.examDate, hours: workedOnPriority7 }, i18n.f)
}

export { clampThreshold } from './defaults'
