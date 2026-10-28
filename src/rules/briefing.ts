// Il briefing del mattino (SPEC §3.3): calcolato sul dispositivo, senza rete,
// dallo stesso contesto delle regole.

import type { Session, TypingRun } from '../db/schema'
import { addDays, diffDays, formatDate, isBetween, withDate, type ISODate } from '../lib/dates'
import type { ThresholdSpec } from './defaults'
import type { DayPlan, RuleContext } from './types'

export interface EnglishStatus {
  /** Giorni di fila con ELSA, fino a oggi (o fino a ieri se oggi manca ancora). */
  streak: number
  minutes7: number
  lastScore?: number
  /** Differenza tra l'ultimo punteggio e il primo degli ultimi 14 giorni. */
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
  english: EnglishStatus
  typing: TypingStatus
}

export function englishStatus(sessions: Session[], today: ISODate): EnglishStatus {
  const english = sessions.filter((s) => !s.deletedAt && s.type === 'inglese')
  const days = new Set(english.map((s) => s.date))
  let day = days.has(today) ? today : addDays(today, -1)
  let streak = 0
  while (days.has(day)) {
    streak++
    day = addDays(day, -1)
  }
  const minutes7 = english.filter((s) => isBetween(s.date, addDays(today, -6), today)).reduce((n, s) => n + s.minutes, 0)
  const scored = english
    .filter((s) => typeof s.score === 'number' && isBetween(s.date, addDays(today, -13), today))
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

export function weekStatus(ctx: Pick<RuleContext, 'sessions' | 'today'>, runs: TypingRun[]): WeekStatus {
  return { english: englishStatus(ctx.sessions, ctx.today), typing: typingStatus(runs, ctx.today) }
}

/** La frase sulla priorità: perché quella materia oggi. */
export function priorityReason(plan: DayPlan, workedOnPriority7: number): string | undefined {
  const p = plan.priority
  if (!p) return undefined
  const when = p.days === 0 ? 'oggi' : p.days === 1 ? 'domani' : `tra ${p.days} giorni`
  const hours =
    workedOnPriority7 > 0
      ? ` Negli ultimi 7 giorni ci hai dedicato ${(Math.round(workedOnPriority7 * 2) / 2).toLocaleString('it-IT')} h.`
      : ' Negli ultimi 7 giorni non ci hai ancora lavorato.'
  return `È l’esame più vicino: ${when}, ${withDate('il', formatDate(p.examDate))}.${hours}`
}

/** Una soglia valida: dentro i limiti e sul passo previsto. */
export function clampThreshold(spec: ThresholdSpec, value: number): number {
  if (!Number.isFinite(value)) return spec.value
  const step = spec.step ?? 1
  const stepped = Math.round(value / step) * step
  return Math.min(spec.max, Math.max(spec.min, Number(stepped.toFixed(4))))
}
