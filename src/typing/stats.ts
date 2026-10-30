// Statistiche della Dattilografia: errori per tasto e progressi per lezione.

import type { TypingRun } from '../db/schema'
import { KEYS } from '../review/keyboard'
import { DEFAULT_TUNING, type Tuning } from '../rules/defaults'
import { LESSONS, type LessonId } from './lessons'

export interface KeyRate {
  key: string
  errors: number
  hits: number
  /** errori / tentativi */
  rate: number
}

export function keyRates(runs: TypingRun[]): Map<string, KeyRate> {
  const out = new Map<string, KeyRate>()
  for (const run of runs) {
    if (run.deletedAt) continue
    for (const [key, hits] of Object.entries(run.keyHits)) {
      const r = out.get(key) ?? { key, errors: 0, hits: 0, rate: 0 }
      r.hits += hits
      out.set(key, r)
    }
    for (const [key, errors] of Object.entries(run.keyErrors)) {
      const r = out.get(key) ?? { key, errors: 0, hits: 0, rate: 0 }
      r.errors += errors
      out.set(key, r)
    }
  }
  for (const r of out.values()) r.rate = r.hits ? Math.min(1, r.errors / r.hits) : r.errors ? 1 : 0
  return out
}

/** I tasti dove sbagli di più, con abbastanza tentativi per fidarsi. */
export function worstKeys(runs: TypingRun[], tuning: Tuning = DEFAULT_TUNING): KeyRate[] {
  const n = tuning.dattilografia.worstKeys!
  const minHits = tuning.dattilografia.worstKeysMinHits!
  return [...keyRates(runs).values()]
    .filter((r) => r.hits >= minHits && r.errors > 0 && KEYS.has(r.key) && r.key !== 'space')
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)
    .slice(0, n)
}

export interface LessonProgress {
  runs: number
  bestWpm: number
  bestAccuracy: number
  last?: TypingRun
}

export function lessonProgress(runs: TypingRun[]): Record<string, LessonProgress> {
  const out: Record<string, LessonProgress> = {}
  for (const run of [...runs].filter((r) => !r.deletedAt).sort((a, b) => a.at - b.at)) {
    const p = (out[run.lesson] ??= { runs: 0, bestWpm: 0, bestAccuracy: 0 })
    p.runs++
    p.bestWpm = Math.max(p.bestWpm, run.wpm)
    p.bestAccuracy = Math.max(p.bestAccuracy, run.accuracy)
    p.last = run
  }
  return out
}

/** Soglie predefinite: una lezione è superata con il 95% di precisione e 25 parole al minuto. */
export const PASS = { accuracy: 0.95, wpm: 25 }

export function isPassed(p: LessonProgress | undefined, tuning: Tuning = DEFAULT_TUNING): boolean {
  const t = tuning.dattilografia
  return !!p && p.runs > 0 && p.bestAccuracy >= t.passAccuracy! / 100 && p.bestWpm >= t.passWpm!
}

/** La prossima lezione del percorso: la prima non ancora superata. */
export function recommendedLesson(runs: TypingRun[], tuning: Tuning = DEFAULT_TUNING): LessonId {
  const progress = lessonProgress(runs)
  return LESSONS.find((l) => !isPassed(progress[l.id], tuning))?.id ?? 'testi'
}
