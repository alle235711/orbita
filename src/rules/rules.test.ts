import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Course, RuleConfig, RuleId, Session, Workout } from '../db/schema'
import { SEED_COURSES, SEED_DEADLINES, seedRules } from '../db/seed'
import { addDays } from '../lib/dates'
import type { Energy } from '../lib/energy'
import { evaluate, hardestCourse, itemDuration } from './plan'
import { examsAhead, leanGap } from './rules'
import { scheduleDay } from './schedule'
import type { RuleContext } from './types'

// Martedì 27 ottobre 2026: Struttura della Materia tra 17 giorni.
const TODAY = '2026-10-27'

let seq = 0
const id = () => `x${++seq}`

function ctx(over: Partial<RuleContext> = {}): RuleContext {
  return {
    today: TODAY,
    now: 8 * 60,
    energy: 3,
    courses: structuredClone(SEED_COURSES),
    deadlines: structuredClone(SEED_DEADLINES),
    events: [],
    sessions: [],
    workouts: [],
    cards: { due: {}, fresh: {} },
    rules: seedRules(),
    ...over,
  }
}

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
  return seedRules().map((r) => (r.id === id ? { ...r, ...change, thresholds: { ...r.thresholds, ...change.thresholds } } : r))
}

const withDifficulty = (courseId: string, difficulty: Course['difficulty']) =>
  structuredClone(SEED_COURSES).map((c) => (c.id === courseId ? { ...c, difficulty } : c))

const titles = (c: RuleContext) => evaluate(c).items.map((i) => i.title)
const noteRules = (c: RuleContext) => evaluate(c).notes.map((n) => n.ruleId)

describe('regola 1: esame entro 21 giorni', () => {
  it('rende la materia la priorità 1', () => {
    const plan = evaluate(ctx())
    expect(plan.priority).toMatchObject({ courseId: 'sdm', days: 17, fromRule: true })
    expect(plan.notes[0]).toMatchObject({ ruleId: 'esame-vicino', title: 'Struttura della Materia è la priorità 1' })
    expect(plan.items[0]?.courseId).toBe('sdm')
  })

  it('non scatta oltre la soglia, che si può cambiare', () => {
    expect(evaluate(ctx({ today: '2026-10-20' })).priority).toBeUndefined()
    expect(evaluate(ctx({ today: '2026-10-20', rules: withRule('esame-vicino', { thresholds: { days: 30 } }) })).priority?.courseId).toBe('sdm')
  })

  it('si può disattivare', () => {
    expect(evaluate(ctx({ rules: withRule('esame-vicino', { enabled: false }) })).priority).toBeUndefined()
    expect(noteRules(ctx({ rules: withRule('esame-vicino', { enabled: false }) }))).not.toContain('esame-vicino')
  })

  it('le date con solo il mese contano dal 1°', () => {
    expect(evaluate(ctx({ today: '2027-01-10' })).priority).toBeUndefined()
    const plan = evaluate(ctx({ today: '2027-01-11' }))
    expect(plan.priority).toMatchObject({ courseId: 'anelli', days: 21 })
  })

  it('ignora gli esami già passati e considera quello di oggi', () => {
    expect(examsAhead(SEED_COURSES, '2026-11-14')[0]?.course.id).toBe('calcolo')
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
    expect(plan.items[0]).toMatchObject({ title: 'Ripasso attivo di Struttura della Materia', minutes: 45 })
    expect(plan.items.some((i) => /Teoria nuova/.test(i.title))).toBe(false)
    expect(plan.rule).toMatch(/blocchi da 45 minuti/)
    expect(evaluate(ctx({ energy: 1, rules: withRule('energia-bassa', { thresholds: { block: 30 } }) })).items[0]?.minutes).toBe(30)
  })

  it('regola 2 disattivata: l’energia bassa segue la fascia regolare', () => {
    expect(evaluate(ctx({ energy: 2, rules: withRule('energia-bassa', { enabled: false }) })).tier).toBe('mid')
  })

  it('regola 3: esame più vicino per primo, 90 minuti con 15 di pausa', () => {
    const plan = evaluate(ctx({ energy: 3 }))
    expect(plan.headline[1]).toBe('da esercizi')
    expect(plan.items[0]).toMatchObject({ title: 'Esercizi di Struttura della Materia', blocks: { count: 2, minutes: 90, pause: 15 } })
    expect(itemDuration(plan.items[0]!)).toBe('2 × 90 min')
    expect(plan.items[1]?.title).toBe('Esercizi di Calcolo per l’Astronomia')
    const custom = evaluate(ctx({ rules: withRule('energia-media', { thresholds: { block: 60, pause: 10 } }) }))
    expect(custom.items[0]?.blocks).toEqual({ count: 2, minutes: 60, pause: 10 })
  })

  it('regola 4: la teoria più difficile nelle prime ore', () => {
    const plan = evaluate(ctx({ energy: 4 }))
    expect(plan.headline[1]).toBe('da teoria nuova')
    expect(plan.items[0]).toMatchObject({ title: 'Teoria nuova di Struttura della Materia', morning: true })
    expect(plan.rule).toMatch(/quasar/)
    expect(evaluate(ctx({ energy: 5 })).rule).toMatch(/blazar/)
  })

  it('regola 4 senza esami vicini: vince la difficoltà, poi l’esame più vicino', () => {
    const early = { today: '2026-10-01', energy: 5 as Energy }
    expect(evaluate(ctx(early)).items[0]?.title).toBe('Teoria nuova di Struttura della Materia')
    const plan = evaluate(ctx({ ...early, courses: withDifficulty('topalg', 3) }))
    expect(plan.items[0]?.title).toBe('Teoria nuova di Topologia Algebrica')
    expect(plan.items[1]?.title).toBe('Esercizi di Struttura della Materia')
    expect(hardestCourse(examsAhead(withDifficulty('astrost', 3), '2026-10-01'))?.id).toBe('astrost')
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
    expect(plan.sport.mainDone).toBe(0)
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

describe('regola 6: Lean', () => {
  it('fermo da più di 2 giorni: 30 minuti nel piano di domani', () => {
    const plan = evaluate(ctx({ sessions: [session('2026-10-24', 40, 'lean')] }))
    expect(plan.leanGap).toBe(3)
    expect(plan.tomorrow[0]).toMatchObject({ kind: 'lean', minutes: 30 })
    expect(plan.items.some((i) => i.kind === 'lean')).toBe(false)
    expect(plan.notes.find((n) => n.ruleId === 'lean')?.title).toBe('Lean fermo da 3 giorni')
  })

  it('il giorno dopo la mezz’ora è nel piano di oggi', () => {
    const plan = evaluate(ctx({ sessions: [session('2026-10-23', 40, 'lean')] }))
    expect(plan.items.find((i) => i.kind === 'lean')?.minutes).toBe(30)
  })

  it('niente note entro la soglia o se l’hai già fatto oggi', () => {
    expect(evaluate(ctx({ sessions: [session('2026-10-25', 40, 'lean')] })).tomorrow).toEqual([])
    expect(evaluate(ctx({ sessions: [session(TODAY, 20, 'lean')] })).notes.some((n) => n.ruleId === 'lean')).toBe(false)
    expect(evaluate(ctx({ sessions: [session('2026-10-23', 40, 'lean')], rules: withRule('lean', { thresholds: { days: 5 } }) })).tomorrow).toEqual([])
  })

  it('mai fatto: entra subito', () => {
    expect(leanGap([], TODAY)).toBe(Infinity)
    expect(evaluate(ctx()).items.some((i) => i.kind === 'lean')).toBe(true)
    expect(evaluate(ctx({ rules: withRule('lean', { enabled: false }) })).items.some((i) => i.kind === 'lean')).toBe(false)
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
      session(TODAY, 300, 'lean'),
      session(TODAY, 300, 'inglese'),
      session(addDays(TODAY, -7), 600, 'studio'),
      session(addDays(TODAY, -6), 60, 'lavoro'),
    ]
    expect(evaluate(ctx({ sessions })).hours.last7).toBe(3)
  })
})

describe('regola 8: schede scadute', () => {
  it('inserisce 15–20 minuti a partire dall’esame più vicino', () => {
    const plan = evaluate(ctx({ cards: { due: { astrost: 5, sdm: 7 }, fresh: {} } }))
    const item = plan.items.find((i) => i.kind === 'ripasso')
    expect(item).toMatchObject({ minutes: 15, courseId: 'sdm', detail: '12 schede scadute, prima Struttura della Materia.' })
    expect(plan.notes.find((n) => n.ruleId === 'schede-scadute')?.title).toBe('12 schede scadute')
    expect(evaluate(ctx({ cards: { due: { sdm: 40 }, fresh: {} } })).items.find((i) => i.kind === 'ripasso')?.minutes).toBe(20)
  })

  it('senza scadute propone le nuove, senza nota', () => {
    const plan = evaluate(ctx({ cards: { due: {}, fresh: { sdm: 15 } } }))
    expect(plan.items.find((i) => i.kind === 'ripasso')?.detail).toBe('15 schede nuove di Struttura della Materia.')
    expect(plan.notes.some((n) => n.ruleId === 'schede-scadute')).toBe(false)
  })

  it('niente schede o regola spenta: niente ripasso', () => {
    expect(titles(ctx())).not.toContain('Ripasso a 10 dita')
    expect(titles(ctx({ cards: { due: { sdm: 3 }, fresh: {} }, rules: withRule('schede-scadute', { enabled: false }) }))).not.toContain('Ripasso a 10 dita')
  })
})

describe('regola 9: tirocinio', () => {
  // Date finte: nel seed il tirocinio non ne ha, si inseriscono in Dati.
  const tirocinio = (date?: string, endDate?: string) =>
    structuredClone(SEED_DEADLINES).map((d) => (d.id === 'tirocinio' ? { ...d, date, endDate } : d))
  const deadlines = tirocinio('2027-03-15', '2027-04-24')
  const DURING = '2027-03-22' // lunedì

  it('la nota elide l’articolo: "Fino all’11 aprile"', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines: tirocinio('2027-03-15', '2027-04-11') }))
    expect(plan.notes[0]?.text).toMatch(/^Fino all’11 aprile:/)
  })

  it('nel periodo: palestra e corsa al posto dell’arrampicata', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines }))
    expect(plan.tirocinio).toBe(true)
    expect(plan.sport.main).toBe('palestra')
    expect(titles(ctx({ today: DURING, deadlines }))).toContain('Palestra')
    expect(titles(ctx({ today: DURING, deadlines }))).not.toContain('Arrampicata')
    expect(plan.notes[0]?.ruleId).toBe('tirocinio')
  })

  it('estremi compresi', () => {
    expect(evaluate(ctx({ today: '2027-03-15', deadlines })).tirocinio).toBe(true)
    expect(evaluate(ctx({ today: '2027-04-24', deadlines })).tirocinio).toBe(true)
    expect(evaluate(ctx({ today: '2027-03-14', deadlines })).tirocinio).toBe(false)
    expect(evaluate(ctx({ today: '2027-04-25', deadlines })).tirocinio).toBe(false)
  })

  it('ha un obiettivo orario e soglie sportive a parte', () => {
    const rules = withRule('tirocinio', { thresholds: { hoursPerDay: 6, gym: 2 } })
    const plan = evaluate(ctx({ today: DURING, deadlines, rules }))
    expect(plan.hours.target7).toBe(42)
    expect(plan.sport.mainTarget).toBe(2)
  })

  it('disattivata: valgono le regole di sempre', () => {
    const plan = evaluate(ctx({ today: DURING, deadlines, rules: withRule('tirocinio', { enabled: false }) }))
    expect(plan.tirocinio).toBe(false)
    expect(plan.sport.main).toBe('arrampicata')
  })

  it('segue le date modificate', () => {
    expect(evaluate(ctx({ today: DURING, deadlines: tirocinio('2027-04-01', '2027-04-24') })).tirocinio).toBe(false)
  })

  it('senza date, o con una sola, non scatta', () => {
    expect(evaluate(ctx({ today: DURING })).tirocinio).toBe(false)
    expect(evaluate(ctx({ today: DURING, deadlines: tirocinio('2027-03-15') })).tirocinio).toBe(false)
    expect(evaluate(ctx({ today: DURING, deadlines: tirocinio(undefined, '2027-04-24') })).tirocinio).toBe(false)
  })
})

describe('piano', () => {
  it('ha sempre titolo, regola e almeno tre attività', () => {
    for (const energy of [1, 2, 3, 4, 5] as Energy[]) {
      const plan = evaluate(ctx({ energy, cards: { due: { sdm: 4 }, fresh: {} } }))
      expect(plan.headline[0]).toBe('Una giornata')
      expect(plan.rule.length).toBeGreaterThan(20)
      expect(plan.items.length).toBeGreaterThanOrEqual(3)
      expect(new Set(plan.items.map((i) => i.key)).size).toBe(plan.items.length)
    }
  })

  it('senza esami propone studio libero', () => {
    const plan = evaluate(ctx({ courses: SEED_COURSES.map((c) => ({ ...c, examDate: undefined })) }))
    expect(plan.items[0]?.title).toBe('Studio')
  })
})

describe('agenda: collocazione dei blocchi', () => {
  const lessons = [
    event(TODAY, '9:00', '11:00', 'Astrofisica Stellare'),
    event(TODAY, '11:00', '13:00', 'Topologia Algebrica'),
    event(TODAY, '14:30', '16:00', 'Ripetizioni', 'lavoro'),
  ]

  it('mette i blocchi negli spazi liberi con la pausa', () => {
    const plan = evaluate(ctx())
    const blocks = scheduleDay(plan.items, lessons, { from: 8 * 60 })
    const ex = blocks.filter((b) => b.item.key === 'studio:sdm:esercizi')
    expect(ex.map((b) => [b.start, b.end])).toEqual([
      ['13:00', '14:30'],
      ['16:00', '17:30'],
    ])
    expect(ex.map((b) => b.key)).toEqual(['studio:sdm:esercizi#1', 'studio:sdm:esercizi#2'])
  })

  it('parte da adesso, arrotondato al quarto d’ora', () => {
    const plan = evaluate(ctx())
    const blocks = scheduleDay(plan.items, [], { from: 10 * 60 + 7 })
    expect(blocks[0]?.start).toBe('10:15')
  })

  it('non ripropone i blocchi già confermati', () => {
    const plan = evaluate(ctx())
    const confirmed = event(TODAY, '13:00', '14:30', 'Esercizi di Struttura della Materia', 'studio', 'studio:sdm:esercizi#1')
    const blocks = scheduleDay(plan.items, [...lessons, confirmed], { from: 8 * 60 })
    expect(blocks.map((b) => b.key)).not.toContain('studio:sdm:esercizi#1')
    expect(blocks.find((b) => b.key === 'studio:sdm:esercizi#2')?.start).toBe('16:00')
  })

  it('le attività serali vanno dopo le 17:30, quelle con orario restano dove sono', () => {
    const plan = evaluate(ctx({ energy: 1, events: [] }))
    const blocks = scheduleDay(plan.items, [], { from: 8 * 60 })
    const walk = blocks.find((b) => b.item.kind === 'camminata')
    expect(walk && walk.start >= '17:30').toBe(true)
    const fixed = evaluate(ctx({ events: [event(TODAY, '18:30', '20:30', 'Arrampicata', 'sport')] }))
    expect(scheduleDay(fixed.items, [], { from: 8 * 60 }).some((b) => b.item.kind === 'arrampicata')).toBe(false)
  })

  it('lascia fuori quello che non ci sta', () => {
    const plan = evaluate(ctx())
    const blocks = scheduleDay(plan.items, [], { from: 20 * 60 })
    expect(blocks.every((b) => b.end <= '21:00')).toBe(true)
    expect(blocks.length).toBeLessThan(plan.items.reduce((n, i) => n + i.blocks.count, 0))
  })
})
