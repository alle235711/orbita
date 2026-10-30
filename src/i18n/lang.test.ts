import { describe, expect, it } from 'vitest'
import { DEFAULT_LANGUAGE, langForDate, normalizeLanguage } from './lang'

describe('normalizeLanguage', () => {
  it('non lancia e ripulisce', () => {
    expect(normalizeLanguage(undefined)).toEqual(DEFAULT_LANGUAGE)
    expect(normalizeLanguage(null)).toEqual(DEFAULT_LANGUAGE)
    expect(normalizeLanguage('x')).toEqual(DEFAULT_LANGUAGE)
    expect(normalizeLanguage({ base: 'fr', otherDays: 'no' })).toEqual(DEFAULT_LANGUAGE)
    expect(normalizeLanguage({ base: 'en', otherDays: [] })).toEqual({ base: 'en', otherDays: [] })
  })
  it('tiene interi 1..7 senza doppioni, i primi 3, in ordine', () => {
    expect(normalizeLanguage({ base: 'it', otherDays: [7, 0, 8, 2.5, '3', 7, 5, 1, 2] }).otherDays).toEqual([1, 5, 7])
  })
})

describe('langForDate', () => {
  const s = { base: 'it' as const, otherDays: [1, 3] }
  it('usa l’altra lingua nei giorni scelti', () => {
    expect(langForDate('2026-10-26', s)).toBe('en') // lunedì
    expect(langForDate('2026-10-27', s)).toBe('it')
    expect(langForDate('2026-10-28', s)).toBe('en')
    expect(langForDate('2026-10-26', { base: 'en', otherDays: [1] })).toBe('it')
    expect(langForDate('2026-11', { base: 'it', otherDays: [7] })).toBe('en') // 1 novembre 2026 è domenica
  })
})
