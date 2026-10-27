import { describe, expect, it } from 'vitest'
import { SEED_COURSES, SEED_DEADLINES } from '../db/seed'
import { layoutRuler, shortName } from './ruler'

const layout = (width: number, today = '2026-10-27') => layoutRuler(today, SEED_COURSES, SEED_DEADLINES, width)

describe('righello fino alla laurea', () => {
  it('ricalca le posizioni del mockup a 1100 px', () => {
    const r = layout(1100)
    const tick = (label: string) => r.ticks.find((t) => t.label === label)!.x
    expect(tick('nov')).toBeCloseTo(20, -1) // 60 nel mockup, che parte da 40
    expect(tick('lug')).toBeCloseTo(981, -1)
    const next = r.marks.find((m) => m.kind === 'next')!
    expect(next).toMatchObject({ label: 'Struttura tra 17 giorni', row: 0 })
    expect(next.x).toBeCloseTo(68, -1)
    const period = r.marks.find((m) => m.kind === 'period')!
    expect(period).toMatchObject({ label: 'Maldive' })
    expect(period.kind === 'period' && [period.x, period.x2]).toEqual([expect.closeTo(191, -1), expect.closeTo(353, -1)])
    expect(r.marks.find((m) => m.kind === 'group')).toMatchObject({ label: '3 esami' })
    expect(r.marks.find((m) => m.kind === 'laurea')).toMatchObject({ anchor: 'start' })
    expect(r.marks.filter((m) => m.kind === 'exam')).toHaveLength(1) // Calcolo, il 17 novembre
    expect(r.rows).toBe(1)
  })

  it('al telefono le etichette che si toccano salgono di riga', () => {
    const r = layout(358)
    expect(r.rows).toBeGreaterThan(1)
    expect(r.marks.find((m) => m.kind === 'laurea')).toMatchObject({ anchor: 'end' })
    for (const m of r.marks) if ('labelX' in m) expect(m.labelX).toBeGreaterThanOrEqual(0)
  })

  it('dopo gli esami di novembre resta il gruppo di febbraio', () => {
    const r = layout(1100, '2026-11-20')
    expect(r.marks.some((m) => m.kind === 'next')).toBe(false)
    expect(r.marks.find((m) => m.kind === 'group')).toMatchObject({ label: '3 esami' })
    expect(r.ticks[0]?.label).toBe('dic')
  })

  it('descrive il percorso a parole', () => {
    expect(layout(1100).description).toBe(
      'Da oggi alla laurea: Struttura della Materia il 13 novembre, Calcolo per l’Astronomia il 17 novembre, tirocinio alle Maldive dal 14 dicembre al 24 gennaio, 3 esami a febbraio, laurea a luglio.',
    )
  })

  it('accorcia i nomi dei corsi', () => {
    expect(shortName('Struttura della Materia')).toBe('Struttura')
  })
})
