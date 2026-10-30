import { describe, expect, it } from 'vitest'
import type { Session } from '../db/schema'
import { DEFAULT_STUDY_BLOCK, type StudyBlockSettings } from '../modules/types'
import { BLOCK_PRESETS, blockHint, blocksFor } from './blocks'

describe('blocksFor', () => {
  it('medio e alto: il preset stesso; basso: il preset più corto', () => {
    expect(blocksFor('90/15', 'mid')).toEqual({ preset: '90/15', block: 90, pause: 15 })
    expect(blocksFor('90/15', 'high')).toEqual({ preset: '90/15', block: 90, pause: 15 })
    expect(blocksFor('90/15', 'low')).toEqual({ preset: '50/10', block: 50, pause: 10 })
    expect(blocksFor('50/10', 'low')).toEqual({ preset: '45/10', block: 45, pause: 10 })
    expect(blocksFor('45/10', 'low')).toEqual({ preset: '25/5', block: 25, pause: 5 })
  })

  it('il 25/5 resta 25/5 in tutte le fasce', () => {
    for (const tier of ['low', 'mid', 'high'] as const) expect(blocksFor('25/5', tier)).toEqual({ preset: '25/5', block: 25, pause: 5 })
  })

  it('i preset sono nell’ordine dichiarato', () => {
    expect(BLOCK_PRESETS.map((p) => p.id)).toEqual(['25/5', '45/10', '50/10', '90/15'])
  })
})

describe('blockHint', () => {
  const TODAY = '2026-10-28'
  const base: StudyBlockSettings = { preset: '50/10', hint: { ...DEFAULT_STUDY_BLOCK.hint, minSessions: 3, minShare: 0.5 } }
  let n = 0
  const study = (date: string, minutes: number, planned: number | undefined = 50, extra: Partial<Session> = {}): Session => ({
    id: `s${++n}`,
    date,
    minutes,
    type: 'studio',
    planned,
    updatedAt: 1,
    ...extra,
  })
  const dates = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']

  it('suggerisce il preset successivo quando la metà delle sessioni sfora di oltre il 10%', () => {
    const sessions = [study(dates[0]!, 60), study(dates[1]!, 56), study(dates[2]!, 40), study(dates[3]!, 50)]
    expect(blockHint(sessions, TODAY, base)).toEqual({ from: '50/10', to: '90/15', sessions: 4, over: 2, share: 0.5 })
  })

  it('il bordo: 55 minuti su 50 (10%) conta, 54 no', () => {
    expect(blockHint([study(dates[0]!, 55), study(dates[1]!, 55), study(dates[2]!, 55)], TODAY, base)?.over).toBe(3)
    expect(blockHint([study(dates[0]!, 54), study(dates[1]!, 54), study(dates[2]!, 54)], TODAY, base)).toBeNull()
  })

  it('niente suggerimento se è spento, se non c’è un preset più lungo o se mancano sessioni', () => {
    const many = dates.map((d) => study(d, 80))
    expect(blockHint(many, TODAY, { ...base, hint: { ...base.hint, enabled: false } })).toBeNull()
    expect(blockHint(many.map((s) => ({ ...s, planned: 90 })), TODAY, { ...base, preset: '90/15' })).toBeNull()
    expect(blockHint(many.slice(0, 2), TODAY, base)).toBeNull()
  })

  it('conta solo studio, non cancellate, nella finestra e con planned uguale al blocco del preset', () => {
    const ok = dates.slice(0, 3).map((d) => study(d, 80))
    expect(blockHint([...ok, study(dates[3]!, 80, 45)], TODAY, base)?.sessions).toBe(3)
    expect(blockHint([...ok, study(dates[3]!, 80, 50, { planned: undefined })], TODAY, base)?.sessions).toBe(3)
    expect(blockHint([...ok, study(dates[3]!, 80, 50, { deletedAt: 5 })], TODAY, base)?.sessions).toBe(3)
    expect(blockHint([...ok, study(dates[3]!, 80, 50, { type: 'ripasso' })], TODAY, base)?.sessions).toBe(3)
    // fuori finestra (14 giorni): il 15 ottobre è il 14° giorno indietro, il 14 no
    expect(blockHint([...ok, study('2026-10-15', 80)], TODAY, base)?.sessions).toBe(4)
    expect(blockHint([...ok, study('2026-10-14', 80)], TODAY, base)?.sessions).toBe(3)
  })

  it('dopo aver applicato il preset nuovo le vecchie sessioni non contano più', () => {
    const sessions = dates.map((d) => study(d, 80))
    expect(blockHint(sessions, TODAY, base)).not.toBeNull()
    expect(blockHint(sessions, TODAY, { ...base, preset: '90/15' })).toBeNull()
  })

  it('non modifica nulla', () => {
    const sessions = dates.map((d) => study(d, 80))
    const copy = structuredClone(sessions)
    blockHint(sessions, TODAY, base)
    expect(sessions).toEqual(copy)
  })
})
