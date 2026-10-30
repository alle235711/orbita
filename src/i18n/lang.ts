// Lingua dell'interfaccia: una di base e, nei giorni scelti, l'altra.

import { weekday, type ISODate } from '../lib/dates'

export type Lang = 'it' | 'en'
export const LANGS: readonly Lang[] = ['it', 'en']
/** Endonimi: non si traducono mai. */
export const LANG_NAME: Record<Lang, string> = { it: 'Italiano', en: 'English' }
export const MAX_OTHER_DAYS = 3
export const otherLang = (l: Lang): Lang => (l === 'it' ? 'en' : 'it')

export interface LanguageSettings {
  base: Lang
  /** Giorni ISO della settimana, 1 = lunedì … 7 = domenica, in cui l'interfaccia usa l'altra lingua. */
  otherDays: number[]
}

export const DEFAULT_LANGUAGE: LanguageSettings = { base: 'it', otherDays: [] }

/**
 * Accetta qualsiasi valore (vecchi backup, righe rovinate). `base` diverso da
 * 'it'|'en' → 'it'. `otherDays`: solo interi 1..7, senza doppioni (vale la
 * prima occorrenza), i primi 3 in quell'ordine, poi in ordine crescente.
 * Non lancia mai.
 */
export function normalizeLanguage(raw: unknown): LanguageSettings {
  const obj = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const base: Lang = obj.base === 'en' ? 'en' : 'it'
  const days: number[] = []
  if (Array.isArray(obj.otherDays)) {
    for (const d of obj.otherDays as unknown[]) {
      if (typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 7 && !days.includes(d)) days.push(d)
    }
  }
  return { base, otherDays: days.slice(0, MAX_OTHER_DAYS).sort((a, b) => a - b) }
}

/** Lingua di un giorno: l'altra se il giorno della settimana è in `otherDays`, altrimenti la base. */
export function langForDate(date: ISODate, settings: LanguageSettings): Lang {
  const s = normalizeLanguage(settings)
  return s.otherDays.includes(weekday(date)) ? otherLang(s.base) : s.base
}
