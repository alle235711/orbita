import { describe, expect, it } from 'vitest'
import type { RuleId, Session } from '../db/schema'
import { FAKE_COURSES, FAKE_DEADLINES, makeContext } from '../test/fixtures'
import { addDays } from '../lib/dates'
import type { Energy } from '../lib/energy'
import { i18nFor } from '../i18n'
import { renderPlan, type RenderedPlan } from '../i18n/render'
import { evaluate } from './plan'
import type { RuleContext } from './types'

// Prova in inglese, una per regola: testo completo, parole attese in inglese e
// nessuna parola funzione italiana (i nomi dei corsi e delle scadenze, dati
// dell’utente, si tolgono prima del controllo).

const EN = i18nFor('en')
const TODAY = '2026-10-27' // martedì, Fisica Moderna tra 17 giorni
const BROKEN = /undefined|NaN|[{}]/

let seq = 0
const session = (date: string, minutes: number, type: Session['type']): Session => ({ id: `e${++seq}`, date, minutes, type, updatedAt: 1 })

const ctx = (over: Partial<RuleContext> = {}): RuleContext => makeContext({ today: TODAY, ...over })

const render = (c: RuleContext): RenderedPlan => renderPlan(evaluate(c), EN)

function everyText(plan: RenderedPlan): string[] {
  return [
    ...plan.headline,
    plan.rule,
    ...[...plan.items, ...plan.tomorrow].flatMap((i) => [i.title, i.detail]),
    ...plan.notes.flatMap((n) => [n.title, n.text]),
  ]
}

const ITALIAN_STOPWORDS = [' il ', ' della ', ' giorni', ' minuti', 'è ']
const USER_NAMES = [...FAKE_COURSES.map((c) => c.name), ...FAKE_DEADLINES.map((d) => d.title)]

function allText(plan: RenderedPlan): string {
  return ` ${everyText(plan).join(' | ')} `
}

/** Il testo del piano contiene le parole attese (senza badare alle maiuscole) e nessuna parola italiana. */
function expectEnglish(plan: RenderedPlan, words: string[]): void {
  const text = allText(plan)
  const lower = text.toLowerCase()
  for (const w of words) expect(lower, `manca "${w}"`).toContain(w.toLowerCase())
  const bare = USER_NAMES.reduce((t, n) => t.split(n).join(' '), text)
  for (const stop of ITALIAN_STOPWORDS) expect(bare, `parola italiana "${stop}"`).not.toContain(stop)
}

function expectComplete(plan: RenderedPlan, ruleId: RuleId): void {
  const notes = plan.notes.filter((n) => n.ruleId === ruleId)
  const items = [...plan.items, ...plan.tomorrow].filter((i) => i.ruleId === ruleId)
  expect(notes.length + items.length, `la regola ${ruleId} non compare nel piano`).toBeGreaterThan(0)
  for (const n of notes) {
    expect(n.title.trim()).not.toBe('')
    expect(n.text.trim()).not.toBe('')
  }
  for (const text of everyText(plan)) {
    expect(text.trim(), 'testo vuoto').not.toBe('')
    expect(text).not.toMatch(BROKEN)
  }
}

describe('piano in inglese: una prova per regola', () => {
  it('esame-vicino', () => {
    const plan = render(ctx())
    expect(plan.priority?.fromRule).toBe(true)
    expectComplete(plan, 'esame-vicino')
    expectEnglish(plan, ['priority 1', 'The exam is in 17 days', '13 November'])
  })

  it('energia-bassa', () => {
    const plan = render(ctx({ energy: 1 as Energy }))
    expect(plan.tier).toBe('low')
    expectComplete(plan, 'energia-bassa')
    expectEnglish(plan, ['A day', 'to recharge', 'No new theory', 'active review'])
  })

  it('energia-media', () => {
    const plan = render(ctx({ energy: 3 as Energy }))
    expect(plan.tier).toBe('mid')
    expectComplete(plan, 'energia-media')
    expectEnglish(plan, ['for exercises', 'Nearest exam first', '-minute blocks'])
  })

  it('energia-alta', () => {
    const plan = render(ctx({ energy: 4 as Energy }))
    expect(plan.tier).toBe('high')
    expectComplete(plan, 'energia-alta')
    expectEnglish(plan, ['for new theory', 'Hard theory in the first hours', 'while your head can take it'])
  })

  it('sport', () => {
    const plan = render(ctx())
    expect(plan.sport.types.length).toBeGreaterThan(0)
    expectComplete(plan, 'sport')
    expectEnglish(plan, ['to go'])
  })

  it('abilita', () => {
    const plan = render(ctx({ sessions: [session('2026-10-24', 40, 'abilita')] }))
    expect(plan.abilityGap).toBe(3)
    expectComplete(plan, 'abilita')
    expectEnglish(plan, ['Chitarra: no sessions for 3 days', 'Past the threshold'])
  })

  it('ore-settimana', () => {
    const sessions = [5, 7, 7, 7, 7, 7, 7].map((h, i) => session(addDays(TODAY, -i), h * 60, i % 2 ? 'lavoro' : 'studio'))
    const plan = render(ctx({ sessions }))
    expect(plan.hours.tomorrow).toBeGreaterThan(plan.hours.target7 / 7)
    expectComplete(plan, 'ore-settimana')
    expectEnglish(plan, ['behind the pace', 'in the last 7 days'])
  })

  it('schede-scadute', () => {
    const plan = render(ctx({ cards: { due: { 'c-ast': 5, 'c-fis': 7 }, fresh: {} } }))
    expect(plan.items.some((i) => i.kind === 'ripasso')).toBe(true)
    expectComplete(plan, 'schede-scadute')
    expectEnglish(plan, ['overdue cards', 'ten-finger review'])
  })

  it('periodo', () => {
    const deadlines = structuredClone(FAKE_DEADLINES).map((d) => (d.id === 'periodo-prova' ? { ...d, date: '2027-03-15', endDate: '2027-04-24', hoursPerDay: 8, sport: { palestra: 3 } } : d))
    const plan = render(ctx({ today: '2027-03-22', deadlines }))
    expect(plan.period).toBeDefined()
    expectComplete(plan, 'periodo')
    expectEnglish(plan, ['Until 24 April', 'target of 8 h a day, sport with separate targets'])
  })
})
