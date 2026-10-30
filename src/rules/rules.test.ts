import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Course, Deadline, RuleConfig, RuleId, Session, Workout } from '../db/schema'
import { FAKE_COURSES, FAKE_DEADLINES, fakeRules, makeContext } from '../test/fixtures'
import { addDays } from '../lib/dates'
import { DEFAULT_STUDY_BLOCK } from '../modules/types'
import type { Energy } from '../lib/energy'
import { i18nFor } from '../i18n'
import { renderPlan } from '../i18n/render'
import { evaluate as evaluateRaw, hardestCourse, itemDuration } from './plan'
import { abilityGap, examsAhead } from './rules'
import { scheduleDay } from './schedule'
import type { RuleContext } from './types'

const IT = i18nFor('it')
const evaluate = (c: RuleContext) => renderPlan(evaluateRaw(c), IT)

// Martedì 27 ottobre 2026: Fisica Moderna tra 17 giorni.
const TODAY = '2026-10-27'

let seq = 0
const id = () => `x${++seq}`

const ctx = (over: Partial<RuleContext> = {}): RuleContext => makeContext({ today: TODAY, ...over })

const session = (date: string, minutes: number, type: Session['type'] = 'studio'): Session => ({ id: id(), date, minutes, type, updatedAt: 1 })
const workout = (date: string, type: Workout['type']): Workout => ({ id: id(), date, type, minutes: 90, updatedAt: 1 })
const event = (date: string, start: string, end: string, title: string, type: CalendarEvent['type'] = 'lezione', planKey?: string): CalendarEvent => ({
  id: id(),
  date,
  start,
  end,
  title,
  type,
  suggested: !!planKey,
  confirmed: true,
  planKey,
  updatedAt: 1,
})

function withRule(id: RuleId, change: Partial<Pick<RuleConfig, 'enabled'>> & { thresholds?: Record<string, number> }): RuleConfig[] {
  return fakeRules().map((r) => (r.id === id ? { ...r, ...change, thresholds: { ...r.thresholds, ...change.thresholds } } : r))
}

const withDifficulty = (courseId: string, difficulty: Course['difficulty']) =>
  structuredClone(FAKE_COURSES).map((c) => (c.id === courseId ? { ...c, difficulty } : c))

const titles = (c: RuleContext) => evaluate(c).items.map((i) => i.title)
const noteRules = (c: RuleContext) => evaluate(c).notes.map((n) => n.ruleId)

describe('regola 1: esame entro 21 giorni', () => {
  it('rende la materia la priorità 1', () => {
    const plan = evaluate(ctx())
    expect(plan.priority).toMatchObject({ courseId: 'c-fis', days: 17, fromRule: true })
    expect(plan.notes[0]).toMatchObject({ ruleId: 'esame-vicino', title: 'Fisica Moderna è la priorità 1' })
    expect(plan.items[0]?.courseId).toBe('c-fis')
  })

  it('non scatta oltre la soglia, che si può cambiare', () => {
    expect(evaluate(ctx({ today: '2026-10-20' })).priority).toBeUndefined()
    expect(evaluate(ctx({ today: '2026-10-20', rules: withRule('esame-vicino', { thresholds: { days: 30 } }) })).priority?.courseId).toBe('c-fis')
  })

  it('si può disattivare', () => {
    expect(evaluate(ctx({ rules: withRule('esame-vicino', { enabled: false }) })).priority).toBeUndefined()
    expect(noteRules(ctx({ rules: withRule('esame-vicino', { enabled: false }) }))).not.toContain('esame-vicino')
  })

  it('le date con solo il mese contano dal 1°', () => {
    expect(evaluate(ctx({ today: '2027-01-10' })).priority).toBeUndefined()
    const plan = evaluate(ctx({ today: '2027-01-11' }))
    expect(plan.priority).toMatchObject({ courseId: 'c-alg', days: 21 })
  })

  it('ignora gli esami già passati e considera quello di oggi', () => {
    expect(examsAhead(FAKE_COURSES, '2026-11-14')[0]?.course.id).toBe('c-calc')
    expect(evaluate(ctx({ today: '2026-11-13' })).notes[0]?.text).toMatch(/è oggi/)
  })
})

describe('regole 2–4: energia', () => {
  it('sceglie la fascia dal livello del buco nero', () => {
    const tiers = ([1, 2, 3, 4, 5] as Energy[]).map((energy) => evaluate(ctx({ energy })).tier)
    expect(tiers).toEqual(['low', 'low', 'mid', 'high', 'high'])
    expect(evaluate(ctx({ energy: undefined })).tier).toBe('mid')
  })

  it('regola 2: niente teoria nuova e blocchi da 45 minuti', () => {
    const plan = evaluate(ctx({ energy: 2 }))
    expect(plan.headline).toEqual(['Una giornata', 'per ricaricarsi'])
    expect(plan.items[0]).toMatchObject({ title: 'Ripasso attivo di Fisica Moderna', minutes: 50 })
    expect(plan.items.some((i) => /Teoria nuova/.test(i.title))).toBe(false)
    expect(plan.rule).toMatch(/blocchi da 50 minuti/)
    // il blocco basso è il preset subito più corto di quello scelto: 45/10 → 25
    expect(evaluate(ctx({ energy: 1, studyBlock: { ...DEFAULT_STUDY_BLOCK, preset: '45/10' } })).items[0]?.minutes).toBe(25)
  })

  it('regola 2 disattivata: l’energia bassa segue la fascia regolare', () => {
    expect(evaluate(ctx({ energy: 2, rules: withRule('energia-bassa', { enabled: false }) })).tier).toBe('mid')
  })

  it('regola 3: esame più vicino per primo, 90 minuti con 15 di pausa', () => {
    const plan = evaluate(ctx({ energy: 3 }))
    expect(plan.headline[1]).toBe('da esercizi')
    expect(plan.items[0]).toMatchObject({ title: 'Esercizi di Fisica Moderna', blocks: { count: 2, minutes: 90, pause: 15 } })
    expect(itemDuration(plan.items[0]!, IT.f)).toBe('2 × 90 min')
    expect(plan.items[1]?.title).toBe('Esercizi di Calcolo Numerico')
    const custom = evaluate(ctx({ studyBlock: { ...DEFAULT_STUDY_BLOCK, preset: '50/10' } }))
    expect(custom.items[0]?.blocks).toEqual({ count: 2, minutes: 50, pause: 10 })
  })

  it('regola 4: la teoria più difficile nelle prime ore', () => {
    const plan = evaluate(ctx({ energy: 4 }))
    expect(plan.headline[1]).toBe('da teoria nuova')
    expect(plan.items[0]).toMatchObject({ title: 'Teoria nuova di Fisica Moderna', morning: true })
    expect(plan.rule).toMatch(/quasar/)
    expect(evaluate(ctx({ energy: 5 })).rule).toMatch(/blazar/)
  })

  it('regola 4 senza esami vicini: vince la difficoltà, poi l’esame più vicino', () => {
    const early = { today: '2026-10-01', energy: 5 as Energy }
    expect(evaluate(ctx(early)).items[0]?.title).toBe('Teoria nuova di Fisica Moderna')
    const plan = evaluate(ctx({ ...early, courses: withDifficulty('c-top', 3) }))
    expect(plan.items[0]?.title).toBe('Teoria nuova di Topologia Generale')
    expect(plan.items[1]?.title).toBe('Esercizi di Fisica Moderna')
    expect(hardestCourse(examsAhead(withDifficulty('c-ast', 3), '2026-10-01'))?.id).toBe('c-ast')
  })

  it('regola 4 con soglia più alta: Quasar resta regolare', () => {
    expect(evaluate(ctx({ energy: 4, rules: withRule('energia-alta', { thresholds: { minEnergy: 5 } }) })).tier).toBe('mid')
  })
})

describe('regola 5: arrampicata e corsa', () => {
  it('meno di 3 arrampicate: propone la sessione e conta quella di oggi', () => {
    const plan = evaluate(ctx({ workouts: [workout('2026-10-26', 'arrampicata')] }))
    const climb = plan.items.find((i) => i.kind === 'arrampicata')
    expect(climb?.detail).toBe('La seconda delle tre di questa settimana.')
    const note = plan.notes.find((n) => n.title.startsWith('Arrampicata'))
    expect(note).toMatchObject({ title: 'Arrampicata: 1 su 3', level: 'info' })
    expect(note?.text).toMatch(/Ne mancano 2 entro giovedì/)
  })

  it('usa l’orario dell’arrampicata già in agenda', () => {
    const plan = evaluate(ctx({ events: [event(TODAY, '18:30', '20:30', 'Arrampicata', 'sport')] }))
    expect(plan.items.find((i) => i.kind === 'arrampicata')?.at).toBe('18:30')
  })

  it('non propone se hai già arrampicato oggi o hai raggiunto l’obiettivo', () => {
    expect(titles(ctx({ workouts: [workout(TODAY, 'arrampicata')] }))).not.toContain('Arrampicata')
    const three = ['2026-10-26', '2026-10-26', '2026-10-27'].map((d) => workout(d, 'arrampicata'))
    const plan = evaluate(ctx({ workouts: three }))
    expect(plan.items.some((i) => i.kind === 'arrampicata')).toBe(false)
    expect(plan.notes.some((n) => n.title.startsWith('Arrampicata'))).toBe(false)
  })

  it('da giovedì la nota diventa un avviso', () => {
    const thu = evaluate(ctx({ today: '2026-10-29', workouts: [workout('2026-10-26', 'arrampicata')] }))
    expect(thu.notes.find((n) => n.title.startsWith('Arrampicata'))?.level).toBe('avviso')
    const fri = evaluate(ctx({ today: '2026-10-30', workouts: [workout('2026-10-26', 'arrampicata')] }))
    expect(fri.notes.find((n) => n.title.startsWith('Arrampicata'))?.text).toMatch(/questa settimana/)
  })

  it('conta solo la settimana da lunedì', () => {
    const plan = evaluate(ctx({ workouts: [workout('2026-10-25', 'arrampicata'), workout('2026-10-24', 'arrampicata')] }))
    expect(plan.sport.types.find((x) => x.type === 'arrampicata')?.done).toBe(0)
  })

  it('meno di 2 corse: propone una corsa, ma non nello stesso giorno se c’è tempo', () => {
    expect(titles(ctx())).not.toContain('Corsa')
    expect(evaluate(ctx()).notes.find((n) => n.title.startsWith('Corsa'))?.text).toMatch(/prossimi giorni/)
    const met = ['2026-10-26', '2026-10-26', '2026-10-26'].map((d) => workout(d, 'arrampicata'))
    const plan = evaluate(ctx({ workouts: met }))
    expect(plan.items.find((i) => i.kind === 'corsa')).toMatchObject({ detail: 'Nessuna corsa ancora questa settimana.', minutes: 40 })
    // sabato: due giorni per una arrampicata e due corse, non si aspetta più
    const sat = evaluate(ctx({ today: '2026-10-31', workouts: [workout('2026-10-26', 'arrampicata'), workout('2026-10-28', 'arrampicata')] }))
    expect(sat.items.map((i) => i.kind)).toEqual(expect.arrayContaining(['arrampicata', 'corsa']))
  })

  it('con il disco quasi spento lo sport diventa una camminata', () => {
    expect(titles(ctx({ energy: 1 }))).toContain('Camminata')
    const fixed = evaluate(ctx({ energy: 1, events: [event(TODAY, '18:30', '20:30', 'Arrampicata in palestra', 'sport')] }))
    expect(fixed.items.find((i) => i.kind === 'arrampicata')?.at).toBe('18:30')
  })

  it('si può disattivare', () => {
    const plan = evaluate(ctx({ rules: withRule('sport', { enabled: false }) }))
    expect(plan.items.some((i) => i.ruleId === 'sport')).toBe(false)
    expect(plan.notes.some((n) => n.ruleId === 'sport')).toBe(false)
  })
})

describe('regola 6: abilità personale', () => {
  it('fermo da più di 2 giorni: 30 minuti nel piano di domani', () => {
    const plan = evaluate(ctx({ sessions: [session('2026-10-24', 40, 'abilita')] }))
    expect(plan.abilityGap).toBe(3)
    expect(plan.tomorrow[0]).toMatchObject({ kind: 'abilita', minutes: 30 })
    expect(plan.items.some((i) => i.kind === 'abilita')).toBe(false)
    expect(plan.notes.find((n) => n.ruleId === 'abilita')?.title).toBe('Chitarra: nessuna sessione da 3 giorni')
  })

  it('il giorno dopo la mezz’ora è nel piano di oggi', () => {
    const plan = evaluate(ctx({ sessions: [session('2026-10-23', 40, 'abilita')] }))
    expect(plan.items.find((i) => i.kind === 'abilita')?.minutes).toBe(30)
  })

  it('niente note entro la soglia o se l’hai già fatto oggi', () => {
    expect(evaluate(ctx({ sessions: [session('2026-10-25', 40, 'abilita')] })).tomorrow).toEqual([])
    expect(evaluate(ctx({ sessions: [session(TODAY, 20, 'abilita')] })).notes.some((n) => n.ruleId === 'abilita')).toBe(false)
    expect(evaluate(ctx({ sessions: [session('2026-10-23', 40, 'abilita')], rules: withRule('abilita', { thresholds: { days: 5 } }) })).tomorrow).toEqual([])
  })

  it('mai fatto: entra subito', () => {
    expect(abilityGap([], TODAY)).toBe(Infinity)
    expect(evaluate(ctx()).items.some((i) => i.kind === 'abilita')).toBe(true)
    expect(evaluate(ctx({ rules: withRule('abilita', { enabled: false }) })).items.some((i) => i.kind === 'abilita')).toBe(false)
  })
})

describe('regola 7: ore degli ultimi 7 giorni', () => {
  const week = (hours: number[]) => hours.map((h, i) => session(addDays(TODAY, -i), h * 60, i % 2 ? 'lavoro' : 'studio'))

  it('sotto 56 ore alza l’obiettivo di domani della differenza spalmata', () => {
    const plan = evaluate(ctx({ sessions: week([5, 7, 7, 7, 7, 7, 7]) }))
    expect(plan.hours).toMatchObject({ last7: 47, target7: 56, tomorrow: 9.5 })
    expect(plan.notes.find((n) => n.ruleId === 'ore-settimana')?.text).toMatch(/9 h sotto il ritmo/)
  })

  it('non va oltre il massimo', () => {
    expect(evaluate(ctx()).hours.tomorrow).toBe(10)
    expect(evaluate(ctx({ rules: withRule('ore-settimana', { thresholds: { maxHours: 12 } }) })).hours.tomorrow).toBe(12)
  })

  it('a 56 ore non scatta', () => {
    const plan = evaluate(ctx({ sessions: week([8, 8, 8, 8, 8, 8, 8]) }))
    expect(plan.hours.tomorrow).toBe(8)
    expect(plan.notes.some((n) => n.ruleId === 'ore-settimana')).toBe(false)
  })

  it('conta studio, ripasso e lavoro degli ultimi 7 giorni, non il resto', () => {
    const sessions = [
      session(TODAY, 120, 'ripasso'),
      session(TODAY, 300, 'abilita'),
      session(TODAY, 300, 'lingua'),
      session(addDays(TODAY, -7), 600, 'studio'),
      session(addDays(TODAY, -6), 60, 'lavoro'),
    ]
    expect(evaluate(ctx({ sessions })).hours.last7).toBe(3)
  })
})

describe('regola 8: schede scadute', () => {
  it('inserisce 15–20 minuti a partire dall’esame più vicino', () => {
    const plan = evaluate(ctx({ cards: { due: { 'c-ast': 5, 'c-fis': 7 }, fresh: {} } }))
    const item = plan.items.find((i) => i.kind === 'ripasso')
    expect(item).toMatchObject({ minutes: 15, courseId: 'c-fis', detail: '12 schede scadute, prima Fisica Moderna.' })
    expect(plan.notes.find((n) => n.ruleId === 'schede-scadute')?.title).toBe('12 schede scadute')
    expect(evaluate(ctx({ cards: { due: { 'c-fis': 40 }, fresh: {} } })).items.find((i) => i.kind === 'ripasso')?.minutes).toBe(20)
  })

  it('senza scadute propone le nuove, senza nota', () => {
    const plan = evaluate(ctx({ cards: { due: {}, fresh: { 'c-fis': 15 } } }))
    expect(plan.items.find((i) => i.kind === 'ripasso')?.detail).toBe('15 schede nuove di Fisica Moderna.')
    expect(plan.notes.some((n) => n.ruleId === 'schede-scadute')).toBe(false)
  })

  it('niente schede o regola spenta: niente ripasso', () => {
    expect(titles(ctx())).not.toContain('Ripasso a 10 dita')
    expect(titles(ctx({ cards: { due: { 'c-fis': 3 }, fresh: {} }, rules: withRule('schede-scadute', { enabled: false }) }))).not.toContain('Ripasso a 10 dita')
  })
})

describe('regola 9: periodo speciale', () => {
  // Il periodo porta le sue eccezioni: nel periodo palestra e corsa al posto dell'arrampicata.
  const period = (date?: string, endDate?: string, extra: Partial<Deadline> = {}): Deadline[] =>
    structuredClone(FAKE_DEADLINES).map((d) => (d.id === 'periodo-prova' ? { ...d, date, endDate, hoursPerDay: 8, sport: { arrampicata: 0, palestra: 3, corsa: 2 }, ...extra } : d))
  const deadlines = period('2027-03-15', '2027-04-24')
  const DURING = '2027-03-22' // lunedì
  const target = (plan: ReturnType<typeof evaluate>, type: string) => plan.sport.types.find((x) => x.type === type)?.target

  it('la nota elide l’articolo: "Fino all’11 aprile"', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines: period('2027-03-15', '2027-04-11') }))
    expect(plan.notes[0]?.text).toMatch(/^Fino all’11 aprile:/)
    expect(plan.notes[0]?.title).toBe('Periodo di prova')
  })

  it('la nota dice solo le eccezioni che ci sono', () => {
    const hoursOnly = evaluate(ctx({ today: DURING, deadlines: period('2027-03-15', '2027-04-24', { sport: undefined }) }))
    expect(hoursOnly.notes[0]?.text).toBe('Fino al 24 aprile: obiettivo di 8 h al giorno.')
    const none = evaluate(ctx({ today: DURING, deadlines: period('2027-03-15', '2027-04-24', { sport: undefined, hoursPerDay: undefined }) }))
    expect(none.notes[0]?.text).toBe('Fino al 24 aprile: nessuna eccezione.')
    expect(evaluate(ctx({ today: DURING, deadlines })).notes[0]?.text).toBe('Fino al 24 aprile: obiettivo di 8 h al giorno, sport con obiettivi a parte.')
  })

  it('nel periodo: palestra e corsa al posto dell’arrampicata', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines }))
    expect(plan.period).toMatchObject({ name: 'Periodo di prova', start: '2027-03-15', end: '2027-04-24' })
    expect(target(plan, 'palestra')).toBe(3)
    expect(target(plan, 'arrampicata')).toBe(0)
    expect(titles(ctx({ today: DURING, deadlines }))).toContain('Palestra')
    expect(titles(ctx({ today: DURING, deadlines }))).not.toContain('Arrampicata')
    expect(plan.notes[0]?.ruleId).toBe('periodo')
  })

  it('estremi compresi', () => {
    expect(evaluate(ctx({ today: '2027-03-15', deadlines })).period).toBeDefined()
    expect(evaluate(ctx({ today: '2027-04-24', deadlines })).period).toBeDefined()
    expect(evaluate(ctx({ today: '2027-03-14', deadlines })).period).toBeUndefined()
    expect(evaluate(ctx({ today: '2027-04-25', deadlines })).period).toBeUndefined()
  })

  it('ha un obiettivo orario e obiettivi sportivi a parte', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines: period('2027-03-15', '2027-04-24', { hoursPerDay: 6, sport: { palestra: 2 } }) }))
    expect(plan.hours.target7).toBe(42)
    expect(target(plan, 'palestra')).toBe(2)
    expect(target(plan, 'arrampicata')).toBe(3) // non nominata: resta il valore normale
  })

  it('l’eccezione per un tipo spento è ignorata e il giorno limite si cambia', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines: period('2027-03-15', '2027-04-24', { sport: { nuoto: 2 }, deadlineDay: 2 }) }))
    expect(plan.sport.types.some((x) => x.type === 'nuoto')).toBe(false)
    expect(plan.sport.deadline).toBe(2)
  })

  it('disattivata: valgono le regole di sempre', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines, rules: withRule('periodo', { enabled: false }) }))
    expect(plan.period).toBeUndefined()
    expect(target(plan, 'arrampicata')).toBe(3)
  })

  it('segue le date modificate', () => {
    expect(evaluate(ctx({ today: DURING, deadlines: period('2027-04-01', '2027-04-24') })).period).toBeUndefined()
  })

  it('senza date, o con una sola, non scatta', () => {
    expect(evaluate(ctx({ today: DURING })).period).toBeUndefined()
    expect(evaluate(ctx({ today: DURING, deadlines: period('2027-03-15') })).period).toBeUndefined()
    expect(evaluate(ctx({ today: DURING, deadlines: period(undefined, '2027-04-24') })).period).toBeUndefined()
  })

  it('più periodi attivi: vince quello iniziato per ultimo', () => {
    const second: Deadline = { id: 'altro', title: 'Secondo periodo', kind: 'periodo', date: '2027-03-20', endDate: '2027-04-10', updatedAt: 0 }
    const plan = evaluate(ctx({ today: DURING, deadlines: [...deadlines, second] }))
    expect(plan.period?.name).toBe('Secondo periodo')
  })
})

describe('piano', () => {
  it('ha sempre titolo, regola e almeno tre attività', () => {
    for (const energy of [1, 2, 3, 4, 5] as Energy[]) {
      const plan = evaluate(ctx({ energy, cards: { due: { 'c-fis': 4 }, fresh: {} } }))
      expect(plan.headline[0]).toBe('Una giornata')
      expect(plan.rule.length).toBeGreaterThan(20)
      expect(plan.items.length).toBeGreaterThanOrEqual(3)
      expect(new Set(plan.items.map((i) => i.key)).size).toBe(plan.items.length)
    }
  })

  it('senza esami propone studio libero', () => {
    const plan = evaluate(ctx({ courses: FAKE_COURSES.map((c) => ({ ...c, examDate: undefined })) }))
    expect(plan.items[0]?.title).toBe('Studio')
  })
})

describe('agenda: collocazione dei blocchi', () => {
  const lessons = [
    event(TODAY, '9:00', '11:00', 'Cosmologia Osservativa'),
    event(TODAY, '11:00', '13:00', 'Topologia Generale'),
    event(TODAY, '14:30', '16:00', 'Lezioni private', 'lavoro'),
  ]

  it('mette i blocchi negli spazi liberi con la pausa', () => {
    const plan = evaluateRaw(ctx())
    const blocks = scheduleDay(plan.items, lessons, { from: 8 * 60 })
    const ex = blocks.filter((b) => b.item.key === 'studio:c-fis:esercizi')
    expect(ex.map((b) => [b.start, b.end])).toEqual([
      ['13:00', '14:30'],
      ['16:00', '17:30'],
    ])
    expect(ex.map((b) => b.key)).toEqual(['studio:c-fis:esercizi#1', 'studio:c-fis:esercizi#2'])
  })

  it('parte da adesso, arrotondato al quarto d’ora', () => {
    const plan = evaluateRaw(ctx())
    const blocks = scheduleDay(plan.items, [], { from: 10 * 60 + 7 })
    expect(blocks[0]?.start).toBe('10:15')
  })

  it('non ripropone i blocchi già confermati', () => {
    const plan = evaluateRaw(ctx())
    const confirmed = event(TODAY, '13:00', '14:30', 'Esercizi di Fisica Moderna', 'studio', 'studio:c-fis:esercizi#1')
    const blocks = scheduleDay(plan.items, [...lessons, confirmed], { from: 8 * 60 })
    expect(blocks.map((b) => b.key)).not.toContain('studio:c-fis:esercizi#1')
    expect(blocks.find((b) => b.key === 'studio:c-fis:esercizi#2')?.start).toBe('16:00')
  })

  it('le attività serali vanno dopo le 17:30, quelle con orario restano dove sono', () => {
    const plan = evaluateRaw(ctx({ energy: 1, events: [] }))
    const blocks = scheduleDay(plan.items, [], { from: 8 * 60 })
    const walk = blocks.find((b) => b.item.kind === 'camminata')
    expect(walk && walk.start >= '17:30').toBe(true)
    const fixed = evaluateRaw(ctx({ events: [event(TODAY, '18:30', '20:30', 'Arrampicata', 'sport')] }))
    expect(scheduleDay(fixed.items, [], { from: 8 * 60 }).some((b) => b.item.kind === 'arrampicata')).toBe(false)
  })

  it('lascia fuori quello che non ci sta', () => {
    const plan = evaluateRaw(ctx())
    const blocks = scheduleDay(plan.items, [], { from: 20 * 60 })
    expect(blocks.every((b) => b.end <= '21:00')).toBe(true)
    expect(blocks.length).toBeLessThan(plan.items.reduce((n, i) => n + i.blocks.count, 0))
  })
})
