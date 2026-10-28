import { describe, expect, it } from 'vitest'
import type { Session, TypingRun } from '../db/schema'
import { SEED_COURSES, SEED_DEADLINES, seedRules } from '../db/seed'
import { RULE_BY_ID } from './defaults'
import { clampThreshold, englishStatus, priorityReason, typingStatus } from './briefing'
import { evaluate } from './plan'

const TODAY = '2026-10-28'
const elsa = (date: string, score?: number): Session => ({ id: `${date}-${score}`, date, minutes: 15, type: 'inglese', score, updatedAt: 1 })
const run = (date: string, wpm: number, at: number): TypingRun => ({ id: String(at), date, at, lesson: 'base', wpm, accuracy: 0.95, chars: 100, keyErrors: {}, keyHits: {}, updatedAt: 1 })

describe('briefing: inglese', () => {
  it('conta i giorni di fila, anche se oggi manca ancora', () => {
    const s = ['2026-10-25', '2026-10-26', '2026-10-27'].map((d) => elsa(d))
    expect(englishStatus(s, TODAY).streak).toBe(3)
    expect(englishStatus([...s, elsa(TODAY)], TODAY).streak).toBe(4)
    expect(englishStatus([elsa('2026-10-24')], TODAY).streak).toBe(0)
  })

  it('somma i minuti della settimana e segue il punteggio', () => {
    const s = [elsa('2026-10-15', 70), elsa('2026-10-20', 74), elsa('2026-10-27', 79), elsa('2026-10-10', 50)]
    const st = englishStatus(s, TODAY)
    expect(st.minutes7).toBe(15)
    expect(st.lastScore).toBe(79)
    expect(st.scoreChange).toBe(9)
  })
})

describe('briefing: dattilografia', () => {
  it('dice da quanti giorni il record è fermo', () => {
    const st = typingStatus([run('2026-10-20', 30, 1), run('2026-10-23', 34, 2), run('2026-10-27', 33, 3)], TODAY)
    expect(st).toMatchObject({ lastWpm: 33, bestWpm: 34, daysSinceBest: 5, runs7: 2 })
    expect(typingStatus([], TODAY)).toEqual({ runs7: 0 })
  })
})

describe('briefing: priorità e soglie', () => {
  it('spiega la priorità con le ore della settimana', () => {
    const plan = evaluate({
      today: TODAY,
      now: 420,
      energy: 3,
      courses: SEED_COURSES,
      deadlines: SEED_DEADLINES,
      events: [],
      sessions: [],
      workouts: [],
      cards: { due: {}, fresh: {} },
      rules: seedRules(),
    })
    expect(priorityReason(plan, 6.5)).toBe('È l’esame più vicino: tra 16 giorni, il 13 novembre. Negli ultimi 7 giorni ci hai dedicato 6,5 h.')
    const on11 = SEED_COURSES.map((c) => (c.examDate === '2026-11-13' ? { ...c, examDate: '2026-11-11' } : c))
    const plan11 = evaluate({ today: TODAY, now: 420, energy: 3, courses: on11, deadlines: SEED_DEADLINES, events: [], sessions: [], workouts: [], cards: { due: {}, fresh: {} }, rules: seedRules() })
    expect(priorityReason(plan11, 6.5)).toContain('tra 14 giorni, l’11 novembre.')
    expect(priorityReason(plan, 0)).toMatch(/non ci hai ancora lavorato/)
  })

  it('riporta le soglie dentro i limiti e sul passo', () => {
    const days = RULE_BY_ID['esame-vicino'].thresholds.days!
    expect(clampThreshold(days, 30)).toBe(30)
    expect(clampThreshold(days, 0)).toBe(1)
    expect(clampThreshold(days, 500)).toBe(90)
    expect(clampThreshold(days, Number.NaN)).toBe(21)
    const hours = RULE_BY_ID['ore-settimana'].thresholds.hoursPerDay!
    expect(clampThreshold(hours, 7.3)).toBe(7.5)
    const block = RULE_BY_ID['energia-bassa'].thresholds.block!
    expect(clampThreshold(block, 47)).toBe(45)
  })
})
