import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDb, type OrbitaDB } from './db'
import { hasUserData, onboardingState } from './onboarding'
import type { Profile } from './profile'
import { save } from './repo'
import { ensureSeed } from './seed'
import { setSetting } from './settings'

const base: Profile = { totalCfu: 180, lodeValue: 30, yearStart: '09-01' }
const done: Profile = { ...base, completedAt: 1_700_000_000_000 }

describe('onboardingState: tavola della verità', () => {
  it('in caricamento se manca il profilo o i dati', () => {
    expect(onboardingState(undefined, undefined)).toBe('loading')
    expect(onboardingState(undefined, true)).toBe('loading')
    expect(onboardingState(null, undefined)).toBe('loading')
    expect(onboardingState(done, undefined)).toBe('loading')
  })

  it('pronto se il profilo ha completedAt', () => {
    expect(onboardingState(done, false)).toBe('ready')
    expect(onboardingState(done, true)).toBe('ready')
  })

  it('profilo senza completedAt (o con valore non valido): completa il profilo', () => {
    expect(onboardingState(base, false)).toBe('complete-profile')
    expect(onboardingState(base, true)).toBe('complete-profile')
    expect(onboardingState({ ...base, completedAt: 0 }, false)).toBe('complete-profile')
    expect(onboardingState({ ...base, completedAt: Number.NaN }, false)).toBe('complete-profile')
  })

  it('nessun profilo: completa se ci sono dati, altrimenti percorso guidato', () => {
    expect(onboardingState(null, true)).toBe('complete-profile')
    expect(onboardingState(null, false)).toBe('wizard')
  })
})

describe('hasUserData', () => {
  let db: OrbitaDB
  beforeEach(() => {
    db = createDb(`onb-${crypto.randomUUID()}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('è falso con il solo seed, le impostazioni e le regole', async () => {
    await ensureSeed(db)
    await setSetting(db, 'language', { base: 'en', otherDays: [] })
    await db.rules.put({ id: 'sport', enabled: true, thresholds: {}, updatedAt: 1 })
    expect(await hasUserData(db)).toBe(false)
  })

  it('è vero con una riga viva in una delle tabelle dei dati', async () => {
    await save(db.courses, { name: 'Corso finto', sections: [], difficulty: 2 })
    expect(await hasUserData(db)).toBe(true)
  })

  it('ignora le righe cancellate in modo logico', async () => {
    await db.weights.put({ id: 'w', date: '2026-10-20', kg: 70, updatedAt: 1, deletedAt: 2 })
    expect(await hasUserData(db)).toBe(false)
    await db.typingRuns.put({ id: 't', date: '2026-10-20', at: 1, lesson: 'x', wpm: 1, accuracy: 1, chars: 1, keyErrors: {}, keyHits: {}, updatedAt: 1 })
    expect(await hasUserData(db)).toBe(true)
  })
})
