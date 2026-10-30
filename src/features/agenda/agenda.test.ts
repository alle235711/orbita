import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Session } from '../../db/schema'
import { weekDays } from '../../lib/dates'
import { armGlow, eventsByDay, galaxyArms, layoutDay, weekHours } from './agenda'

const ev = (date: string, start: string, end: string, title = 'x', type: CalendarEvent['type'] = 'lezione'): CalendarEvent => ({
  id: `${date}-${start}-${title}`,
  date,
  start,
  end,
  title,
  type,
  suggested: false,
  confirmed: true,
  updatedAt: 1,
})

describe('giornata', () => {
  it('affianca gli impegni che si sovrappongono', () => {
    const placed = layoutDay([ev('d', '9:00', '11:00', 'a'), ev('d', '10:00', '12:00', 'b'), ev('d', '10:30', '11:00', 'c'), ev('d', '14:00', '15:00', 'd')])
    const by = Object.fromEntries(placed.map((p) => [p.item.title, p]))
    expect([by.a!.column, by.b!.column, by.c!.column]).toEqual([0, 1, 2])
    expect(by.a!.columns).toBe(3)
    expect(by.d).toMatchObject({ column: 0, columns: 1 })
  })

  it('riusa la colonna liberata e dà almeno un quarto d’ora agli impegni', () => {
    const placed = layoutDay([ev('d', '9:00', '10:00', 'a'), ev('d', '9:30', '11:00', 'b'), ev('d', '10:15', '10:15', 'c')])
    const c = placed.find((p) => p.item.title === 'c')!
    expect(c.column).toBe(0)
    expect(c.end - c.start).toBe(15)
  })
})

describe('settimana', () => {
  it('raggruppa per giorno in ordine di orario e ignora i cancellati', () => {
    const days = weekDays('2026-10-28')
    const map = eventsByDay([ev('2026-10-28', '14:00', '15:00', 'b'), ev('2026-10-28', '9:00', '10:00', 'a'), { ...ev('2026-10-27', '9:00', '10:00'), deletedAt: 5 }], days)
    expect(map.get('2026-10-28')!.map((e) => e.title)).toEqual(['a', 'b'])
    expect(map.get('2026-10-27')).toEqual([])
    expect(map.size).toBe(7)
  })

  it('conta le ore registrate nei giorni passati e quelle in agenda nei futuri', () => {
    const sessions: Session[] = [
      { id: '1', date: '2026-10-26', minutes: 240, type: 'studio', updatedAt: 1 },
      { id: '2', date: '2026-10-26', minutes: 60, type: 'abilita', updatedAt: 1 },
      { id: '3', date: '2026-10-28', minutes: 90, type: 'lavoro', updatedAt: 1 },
    ]
    const events = [ev('2026-10-30', '9:00', '13:00'), ev('2026-10-30', '18:30', '20:30', 'Arrampicata', 'sport')]
    expect(weekHours('2026-10-28', '2026-10-28', sessions, events)).toEqual([4, 0, 1.5, 0, 4, 0, 0])
  })
})

describe('galassia', () => {
  it('ha sette bracci, il lunedì in alto', () => {
    const arms = galaxyArms(150)
    expect(arms).toHaveLength(7)
    expect(arms[0]!.spine.startsWith('M0.0,-18.0')).toBe(true)
    for (const a of arms) expect(a.ribbon).toMatch(/Z$/)
  })

  it('si accende con le ore', () => {
    expect(armGlow(0)).toBeCloseTo(0.22)
    expect(armGlow(8)).toBeCloseTo(0.9)
    expect(armGlow(12)).toBeCloseTo(0.9)
  })
})
