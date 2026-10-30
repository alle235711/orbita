import { describe, expect, it } from 'vitest'
import { makeContext } from '../test/fixtures'
import { evaluate } from '../rules/plan'
import type { RuleContext } from '../rules/types'
import { AppError, renderError } from './errors'
import { i18nFor } from './index'
import { m, renderMsg, type MsgKey, type PlanMsg } from './messages'
import { renderPlan } from './render'
import { SAMPLES } from './samples'

const IT = i18nFor('it')
const EN = i18nFor('en')

describe('messaggi', () => {
  it('m() senza parametri dà un oggetto vuoto e renderMsg lo rende', () => {
    expect(m('walkTitle')).toEqual({ k: 'walkTitle', p: {} })
    expect(renderMsg(m('walkTitle'), IT)).toBe('Camminata')
  })

  it('ogni chiave del catalogo si rende, con i parametri campione, in modo serializzabile', () => {
    const keys = Object.keys(IT.t.plan.msg) as MsgKey[]
    expect(keys.length).toBeGreaterThan(40)
    for (const k of keys) {
      const sample = SAMPLES[`plan.msg.${k}` as keyof typeof SAMPLES] as unknown[]
      const msg = { k, p: sample[0] } as PlanMsg
      const round = JSON.parse(JSON.stringify(msg)) as PlanMsg
      expect(round).toEqual(msg)
      for (const i18n of [IT, EN]) {
        const text = renderMsg(round, i18n)
        expect(text.length, k).toBeGreaterThan(0)
        expect(text, k).not.toMatch(/undefined|NaN|\[object|\{/)
      }
    }
  })
})

const ctx: RuleContext = makeContext({ today: '2026-10-28', now: 420, cards: { due: { 'c-fis': 12 }, fresh: {} } })

describe('renderPlan', () => {
  it('rende il piano in italiano come nella fase 1 (49c82bc)', () => {
    const plan = renderPlan(evaluate(ctx), IT)
    expect(plan.headline).toEqual(['Una giornata', 'da esercizi'])
    expect(plan.rule).toBe('Accrescimento regolare: l’esame più vicino va per primo, in blocchi da 90 minuti.')
    expect(plan.items.map((i) => i.title)).toEqual([
      'Esercizi di Fisica Moderna',
      'Esercizi di Calcolo Numerico',
      'Ripasso a 10 dita',
      'Chitarra',
      'Arrampicata',
    ])
    expect(plan.items[0]!.detail).toBe('Esercizi d’esame. 16 giorni all’esame.')
    expect(plan.items[2]!.detail).toBe('12 schede scadute, prima Fisica Moderna.')
    expect(plan.notes[0]!.text).toBe('L’esame è tra 16 giorni (13 novembre), entro la soglia di 21 giorni.')
    expect(plan.notes.find((n) => n.ruleId === 'schede-scadute')!.title).toBe('12 schede scadute')
    expect(plan.notes.find((n) => n.ruleId === 'abilita')!.title).toBe('Chitarra: nessuna sessione ancora')
  })

  it('non muta il piano e il piano resta serializzabile', () => {
    const raw = evaluate({ ...ctx, sessions: [] })
    const copy = JSON.stringify({ ...raw, leanGap: 0 })
    renderPlan(raw, IT)
    expect(JSON.stringify({ ...raw, leanGap: 0 })).toBe(copy)
    expect(() => JSON.parse(copy)).not.toThrow()
  })
})

describe('errori', () => {
  it('rende i codici e ripiega su generic', () => {
    expect(renderError(new AppError('invalidJson', { name: 'a.json' }), IT)).toBe('a.json non è un file JSON valido.')
    expect(renderError(new Error('boh'), IT)).toBe('Qualcosa non ha funzionato.')
  })
})
