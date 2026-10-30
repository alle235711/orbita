import { describe, expect, it } from 'vitest'
import { normalizeProfile } from '../db/profile'
import { presetFromBlock } from '../rules/blocks'
import { DEFAULT_MODULES, DEFAULT_STUDY_BLOCK, normalizeModules, normalizeStudyBlock } from './types'

describe('normalizeProfile', () => {
  it('null per ciò che non è un oggetto', () => {
    for (const v of [null, undefined, 3, 'x', [], true]) expect(normalizeProfile(v)).toBeNull()
  })

  it('riempie i predefiniti e non scrive chiavi vuote', () => {
    expect(normalizeProfile({})).toEqual({ totalCfu: 180, lodeValue: 30, yearStart: '09-01' })
  })

  it('limita i numeri e ripulisce i testi', () => {
    const p = normalizeProfile({ name: '  Ada  ', university: '', degree: 7, totalCfu: 9999, lodeValue: 5, yearStart: '13-40', graduationTarget: '2027-07', completedAt: 5 })
    expect(p).toEqual({ name: 'Ada', totalCfu: 600, lodeValue: 30, yearStart: '09-01', graduationTarget: '2027-07', completedAt: 5 })
    expect(normalizeProfile({ totalCfu: 0, lodeValue: 99, yearStart: '02-29' })).toMatchObject({ totalCfu: 1, lodeValue: 40, yearStart: '02-29' })
    expect(normalizeProfile({ totalCfu: 120.6 })!.totalCfu).toBe(121)
  })

  it('scarta obiettivo di laurea e completedAt non validi', () => {
    const p = normalizeProfile({ graduationTarget: '27/07', completedAt: -1 })!
    expect(p.graduationTarget).toBeUndefined()
    expect(p.completedAt).toBeUndefined()
    expect(normalizeProfile({ graduationTarget: '2027-07-15' })!.graduationTarget).toBe('2027-07-15')
  })

  it('è idempotente', () => {
    const once = normalizeProfile({ name: ' x ', totalCfu: 1000 })
    expect(normalizeProfile(once)).toEqual(once)
  })
})

describe('normalizeModules', () => {
  it('senza ingresso dà i predefiniti', () => {
    for (const v of [undefined, null, 3, 'x', []]) expect(normalizeModules(v)).toEqual(DEFAULT_MODULES)
  })

  it('completa le chiavi mancanti in profondità', () => {
    const m = normalizeModules({ sport: { types: { nuoto: { enabled: true } } }, peso: { enabled: true } })
    expect(m.sport.types.nuoto).toEqual({ enabled: true, target: 2, minutes: 45 })
    expect(m.sport.types.corsa).toEqual(DEFAULT_MODULES.sport.types.corsa)
    expect(m.peso.enabled).toBe(true)
    expect(m.lettura.enabled).toBe(true)
  })

  it('limita obiettivi e minuti, a passi di 5, e ripulisce i nomi', () => {
    const m = normalizeModules({
      sport: { enabled: true, types: { corsa: { enabled: true, target: 12, minutes: 3 }, palestra: { enabled: true, target: -2, minutes: 999 }, altro: { enabled: true, target: 1.4, minutes: 47 } } },
      abilita: { enabled: true, name: `  ${'x'.repeat(60)}  ` },
      lingua: { enabled: true, appName: '   ' },
    })
    expect(m.sport.types.corsa).toMatchObject({ target: 7, minutes: 5 })
    expect(m.sport.types.palestra).toMatchObject({ target: 0, minutes: 300 })
    expect(m.sport.types.altro).toMatchObject({ target: 1, minutes: 45 })
    expect(m.abilita.name).toBe('x'.repeat(40))
    expect('appName' in m.lingua).toBe(false)
  })

  it('è idempotente e non lancia con ingressi rovinati', () => {
    const once = normalizeModules({ sport: 5, abilita: { enabled: 'sì', name: 4 }, lavoro: null })
    expect(once).toEqual(DEFAULT_MODULES)
    expect(normalizeModules(once)).toEqual(once)
  })
})

describe('normalizeStudyBlock', () => {
  it('predefiniti e preset non valido', () => {
    expect(normalizeStudyBlock(undefined)).toEqual(DEFAULT_STUDY_BLOCK)
    expect(normalizeStudyBlock({ preset: '30/5' }).preset).toBe('50/10')
    expect(normalizeStudyBlock({ preset: '90/15' }).preset).toBe('90/15')
  })

  it('limita le soglie del suggerimento', () => {
    expect(normalizeStudyBlock({ hint: { enabled: false, lookbackDays: 1, minSessions: 99, minShare: 0.01, overrunPct: 80 } }).hint).toEqual({
      enabled: false,
      lookbackDays: 7,
      minSessions: 30,
      minShare: 0.3,
      overrunPct: 50,
    })
    expect(normalizeStudyBlock({ hint: { minShare: 0.62, lookbackDays: 100 } }).hint).toMatchObject({ minShare: 0.6, lookbackDays: 60 })
    expect(normalizeStudyBlock({ hint: { minShare: 7 } }).hint.minShare).toBe(1)
  })
})

describe('presetFromBlock', () => {
  it('sceglie il preset più vicino, a pari distanza il più lungo', () => {
    expect(presetFromBlock(25)).toBe('25/5')
    expect(presetFromBlock(30)).toBe('25/5')
    expect(presetFromBlock(35)).toBe('45/10')
    expect(presetFromBlock(45)).toBe('45/10')
    expect(presetFromBlock(47)).toBe('45/10')
    expect(presetFromBlock(48)).toBe('50/10')
    expect(presetFromBlock(70)).toBe('90/15')
    expect(presetFromBlock(69)).toBe('50/10')
    expect(presetFromBlock(90)).toBe('90/15')
    expect(presetFromBlock(500)).toBe('90/15')
    expect(presetFromBlock(1)).toBe('25/5')
  })
})
