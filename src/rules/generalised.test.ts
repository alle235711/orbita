import { describe, expect, it } from 'vitest'
import type { Course, Session, Workout } from '../db/schema'
import { i18nFor } from '../i18n'
import { renderPlan } from '../i18n/render'
import { lastDayOfMonth } from '../lib/dates'
import { applyReview, intervalsFor, suggestedOutcome } from '../review/leitner'
import { startTyping, typingStats } from '../review/typing'
import { FAKE_COURSES, fakeRules, makeContext } from '../test/fixtures'
import { normalizeModules, type ModulesSettings } from '../modules/types'
import { clampThreshold, DEFAULT_TUNING, GROUPS, resolveGroups } from './defaults'
import { evaluate as evaluateRaw } from './plan'
import { examsAhead, hoursInWindow, resolveRules } from './rules'
import { scheduleDay } from './schedule'
import type { RuleContext } from './types'

const IT = i18nFor('it')
const evaluate = (c: RuleContext) => renderPlan(evaluateRaw(c), IT)
const TODAY = '2026-10-27' // martedì

let seq = 0
const workout = (date: string, type: Workout['type']): Workout => ({ id: `w${++seq}`, date, type, minutes: 60, updatedAt: 1 })
const session = (date: string, minutes: number, type: Session['type']): Session => ({ id: `s${++seq}`, date, minutes, type, updatedAt: 1 })
const modules = (change: (m: ModulesSettings) => void): ModulesSettings => {
  const m = normalizeModules(structuredClone(makeContext().modules))
  change(m)
  return m
}

describe('esame con il solo mese', () => {
  const feb = (d: Partial<Course> = {}): Course[] => [{ ...FAKE_COURSES[2]!, examDate: '2027-02', ...d }]

  it('conta dal 1° finché non è passato, poi fino all’ultimo giorno del mese', () => {
    expect(examsAhead(feb(), '2027-01-11')[0]).toMatchObject({ date: '2027-02-01', days: 21 })
    expect(examsAhead(feb(), '2027-02-01')[0]).toMatchObject({ date: '2027-02-01', days: 0 })
    expect(examsAhead(feb(), '2027-02-10')[0]).toMatchObject({ date: '2027-02-28', days: 18 })
    expect(examsAhead(feb(), '2027-02-28')[0]).toMatchObject({ date: '2027-02-28', days: 0 })
    expect(examsAhead(feb(), '2027-03-01')).toEqual([])
  })

  it('le date complete non cambiano: oggi resta, ieri sparisce', () => {
    const c = (examDate: string) => [{ ...FAKE_COURSES[0]!, examDate }]
    expect(examsAhead(c('2026-10-27'), TODAY)).toHaveLength(1)
    expect(examsAhead(c('2026-10-26'), TODAY)).toEqual([])
  })

  it('lastDayOfMonth', () => {
    expect(lastDayOfMonth('2027-02')).toBe('2027-02-28')
    expect(lastDayOfMonth('2028-02-10')).toBe('2028-02-29')
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31')
  })

  it('il piano tiene l’esame come priorità a metà mese', () => {
    const plan = evaluate(makeContext({ today: '2027-02-10', courses: feb(), rules: fakeRules().map((r) => (r.id === 'esame-vicino' ? { ...r, thresholds: { ...r.thresholds, days: 30 } } : r)) }))
    expect(plan.priority).toMatchObject({ days: 18 })
  })
})

describe('sport sui tipi configurati', () => {
  const swim = modules((m) => {
    m.sport.types.nuoto = { enabled: true, target: 1, minutes: 45 }
    m.sport.types.arrampicata.target = 0
    m.sport.types.corsa.target = 0
  })

  it('propone il nuoto con i minuti configurati e il titolo del tipo', () => {
    const plan = evaluate(makeContext({ today: TODAY, modules: swim }))
    const item = plan.items.find((i) => i.kind === 'nuoto')
    expect(item).toMatchObject({ title: 'Nuoto', minutes: 45, ruleId: 'sport' })
    expect(plan.sport.types.map((x) => x.type)).toEqual(['arrampicata', 'palestra', 'corsa', 'nuoto'])
  })

  it('riconosce l’impegno fisso dalle parole chiave; "altro" non ne ha', () => {
    const event = { id: 'e', date: TODAY, start: '19:00', end: '20:00', title: 'Piscina con gli amici', type: 'sport' as const, suggested: false, confirmed: true, updatedAt: 1 }
    expect(evaluate(makeContext({ today: TODAY, modules: swim, events: [event] })).items.find((i) => i.kind === 'nuoto')?.at).toBe('19:00')
    const other = modules((m) => {
      m.sport.types.altro = { enabled: true, target: 1, minutes: 30 }
      m.sport.types.arrampicata.target = 0
      m.sport.types.corsa.target = 0
    })
    expect(evaluate(makeContext({ today: TODAY, modules: other, events: [{ ...event, title: 'altro' }] })).items.find((i) => i.kind === 'altro')?.at).toBeUndefined()
  })

  it('il secondo sport aspetta se c’è tempo, con il testo dei tipi non corsa', () => {
    const two = modules((m) => {
      m.sport.types.nuoto = { enabled: true, target: 1, minutes: 45 }
      m.sport.types.corsa.target = 0
    })
    const plan = evaluate(makeContext({ today: TODAY, modules: two }))
    expect(plan.items.some((i) => i.kind === 'arrampicata')).toBe(true)
    expect(plan.items.some((i) => i.kind === 'nuoto')).toBe(false)
    expect(plan.notes.find((n) => n.title.startsWith('Nuoto'))?.text).toBe('Ne manca 1: oggi c’è già arrampicata, il resto va nei prossimi giorni.')
  })

  it('con lo sport spento non c’è né sport né camminata', () => {
    const off = modules((m) => (m.sport.enabled = false))
    const plan = evaluate(makeContext({ today: TODAY, modules: off, energy: 1 }))
    expect(plan.sport.types).toEqual([])
    expect(plan.items.some((i) => i.ruleId === 'sport' || i.kind === 'camminata')).toBe(false)
    expect(plan.notes.some((n) => n.ruleId === 'sport')).toBe(false)
  })

  it('sport spento: le sessioni fatte non compaiono nei tipi', () => {
    const plan = evaluate(makeContext({ today: TODAY, workouts: [workout(TODAY, 'arrampicata')] }))
    expect(plan.sport.types.find((x) => x.type === 'arrampicata')?.done).toBe(1)
  })
})

describe('note dello sport', () => {
  it('la corsa in piano dice i minuti, anche quando è l’unica voce', () => {
    const met = ['2026-10-26', '2026-10-26', '2026-10-26'].map((d) => workout(d, 'arrampicata'))
    const plan = evaluate(makeContext({ today: TODAY, workouts: met }))
    expect(plan.notes.find((n) => n.title.startsWith('Corsa'))?.text).toBe('Ne mancano 2: una corsa da 40 minuti è nel piano.')
  })
})

describe('moduli spenti nel piano', () => {
  it('abilità spenta: niente voce, niente nota, niente domani', () => {
    const m = modules((x) => (x.abilita.enabled = false))
    const plan = evaluate(makeContext({ today: TODAY, modules: m }))
    expect(plan.items.some((i) => i.kind === 'abilita')).toBe(false)
    expect(plan.tomorrow).toEqual([])
    expect(plan.notes.some((n) => n.ruleId === 'abilita')).toBe(false)
  })

  it('senza nome l’abilità usa la parola del dizionario', () => {
    const m = modules((x) => delete x.abilita.name)
    const plan = evaluate(makeContext({ today: TODAY, modules: m, sessions: [session('2026-10-24', 30, 'abilita')] }))
    expect(plan.notes.find((n) => n.ruleId === 'abilita')?.title).toBe('Abilità personale: nessuna sessione da 3 giorni')
  })

  it('lettura spenta: niente riempitivo nelle giornate leggere', () => {
    const on = evaluate(makeContext({ today: TODAY, energy: 1, modules: modules((x) => (x.sport.enabled = false)) }))
    expect(on.items.some((i) => i.kind === 'lettura')).toBe(true)
    const off = evaluate(makeContext({ today: TODAY, energy: 1, modules: modules((x) => ((x.sport.enabled = false), (x.lettura.enabled = false))) }))
    expect(off.items.some((i) => i.kind === 'lettura')).toBe(false)
  })

  it('lavoro spento: le sue ore non contano', () => {
    const sessions = [session(TODAY, 600, 'lavoro'), session(TODAY, 120, 'studio')]
    expect(evaluate(makeContext({ today: TODAY, sessions })).hours.last7).toBe(12)
    expect(evaluate(makeContext({ today: TODAY, sessions, modules: modules((x) => (x.lavoro.enabled = false)) })).hours.last7).toBe(2)
    expect(hoursInWindow(sessions, TODAY, TODAY)).toBe(12)
    expect(hoursInWindow(sessions, TODAY, TODAY, ['studio'])).toBe(2)
  })
})

describe('blocchi dal preset', () => {
  it('la frase e gli elementi seguono il preset', () => {
    const plan = evaluate(makeContext({ today: TODAY, energy: 1, studyBlock: { preset: '25/5', hint: makeContext().studyBlock.hint } }))
    expect(plan.items[0]).toMatchObject({ minutes: 25, blocks: { count: 1, minutes: 25, pause: 5 } })
    expect(plan.rule).toMatch(/blocchi da 25 minuti/)
    const high = evaluate(makeContext({ today: TODAY, energy: 5 }))
    expect(high.items[0]?.blocks).toEqual({ count: 2, minutes: 90, pause: 15 })
  })

  it('il secondo esercizio e la pausa seguono il gruppo giornata e il preset', () => {
    const rules = [...fakeRules(), { id: 'giornata' as const, enabled: true, thresholds: { secondExerciseMinutes: 30 }, updatedAt: 1 }]
    const plan = evaluate(makeContext({ today: TODAY, rules }))
    expect(plan.items[1]).toMatchObject({ minutes: 30, blocks: { count: 1, minutes: 30, pause: 15 } })
  })
})

describe('soglie generali', () => {
  it('i gruppi hanno i predefiniti e restano dentro i limiti', () => {
    const t = resolveGroups([{ id: 'giornata', thresholds: { dayStart: 5, dayEnd: 99999, walkMinutes: 47 } }, { id: 'storico', deletedAt: 3, thresholds: { sessionsDays: 90 } }])
    expect(t.giornata).toMatchObject({ dayStart: 240, dayEnd: 1439, walkMinutes: 45, readingMinutes: 30 })
    expect(t.storico.sessionsDays).toBe(30) // riga cancellata: vale il predefinito
    expect(resolveGroups([])).toEqual(DEFAULT_TUNING)
    expect(DEFAULT_TUNING.ripasso).toMatchObject({ box1: 1, box5: 16, minAccuracy: 97, minSimilarity: 85 })
    expect(clampThreshold(GROUPS.registra.studyMinutes!, 1000)).toBe(300)
  })

  it('le regole: ore al giorno 6 se la riga manca, soglie nuove di avviso', () => {
    const r = resolveRules([])
    expect(r['ore-settimana'].t).toMatchObject({ hoursPerDay: 6, warnDeficitDays: 1 })
    expect(r['esame-vicino'].t.warnDays).toBe(7)
    expect(r['schede-scadute'].t.warnDue).toBe(40)
    expect(r.sport.t).toEqual({ deadline: 4 })
    expect(r.periodo.t).toEqual({})
  })

  it('l’avviso dell’esame segue la soglia', () => {
    const rules = fakeRules().map((r) => (r.id === 'esame-vicino' ? { ...r, thresholds: { ...r.thresholds, warnDays: 30 } } : r))
    expect(evaluate(makeContext({ today: TODAY, rules })).notes.find((n) => n.ruleId === 'esame-vicino')?.level).toBe('avviso')
    expect(evaluate(makeContext({ today: TODAY })).notes.find((n) => n.ruleId === 'esame-vicino')?.level).toBe('info')
  })

  it('l’agenda parte dai valori della giornata', () => {
    const items = evaluate(makeContext({ today: TODAY })) && evaluateRaw(makeContext({ today: TODAY })).items
    const tuning = resolveGroups([{ id: 'giornata', thresholds: { dayStart: 600, roundStep: 30 } }])
    const blocks = scheduleDay(items.slice(0, 1), [], { from: 0, tuning })
    expect(blocks[0]?.start).toBe('10:00')
    const rounded = scheduleDay(items.slice(0, 1), [], { from: 8 * 60 + 1, tuning: resolveGroups([{ id: 'giornata', thresholds: { roundStep: 30 } }]) })
    expect(rounded[0]?.start).toBe('8:30')
  })

  it('Leitner e battitura accettano i valori', () => {
    const t = resolveGroups([{ id: 'ripasso', thresholds: { box2: 3, minAccuracy: 90 } }])
    expect(intervalsFor(t)).toEqual({ 1: 1, 2: 3, 3: 4, 4: 8, 5: 16 })
    expect(intervalsFor()).toEqual({ 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 })
    expect(suggestedOutcome('copia', 0.92)).toBe(false)
    expect(suggestedOutcome('copia', 0.92, t)).toBe(true)
    const first = applyReview(undefined, 'c', true, TODAY, t)
    expect(first.state).toMatchObject({ box: 2, due: '2026-10-30' })
    const s = startTyping('ciao')
    const stats = typingStats({ ...s, typed: 'ciao', hits: 4, misses: 0, startedAt: 0, lastAt: 1000 }, undefined, 1)
    expect(stats.wpm).toBe(Math.round(4 / 5 / (1000 / 60_000)))
  })
})
