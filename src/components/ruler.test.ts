import { describe, expect, it } from 'vitest'
import { FAKE_COURSES, FAKE_DEADLINES, FAKE_GRADUATION } from '../test/fixtures'
import { i18nFor } from '../i18n'
import { layoutRuler, shortName } from './ruler'

// Date finte: il periodo di prova non ne ha, si inseriscono in Dati.
const DEADLINES = FAKE_DEADLINES.map((d) => (d.id === 'periodo-prova' ? { ...d, date: '2027-03-15', endDate: '2027-04-24' } : d))
const layout = (width: number, today = '2026-10-27', deadlines = DEADLINES) => layoutRuler(today, FAKE_COURSES, deadlines, width, i18nFor('it'), FAKE_GRADUATION)

describe('righello del tempo', () => {
  it('ricalca le posizioni del mockup a 1100 px', () => {
    const r = layout(1100)
    const tick = (label: string) => r.ticks.find((t) => t.label === label)!.x
    expect(tick('nov')).toBeCloseTo(20, -1) // 60 nel mockup, che parte da 40
    expect(tick('lug')).toBeCloseTo(981, -1)
    const next = r.marks.find((m) => m.kind === 'next')!
    expect(next).toMatchObject({ label: 'Fisica tra 17 giorni', row: 0 })
    expect(next.x).toBeCloseTo(68, -1)
    const period = r.marks.find((m) => m.kind === 'period')!
    expect(period).toMatchObject({ label: 'Periodo di prova' })
    expect(period.kind === 'period' && [period.x, period.x2]).toEqual([expect.closeTo(552, -1), expect.closeTo(711, -1)])
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
      'Da oggi alla laurea: Fisica Moderna il 13 novembre, Calcolo Numerico il 17 novembre, 3 esami a febbraio, Periodo di prova dal 15 marzo al 24 aprile, laurea a luglio.',
    )
  })

  it('elide l’articolo davanti a 8 e 11 nella descrizione', () => {
    const deadlines = FAKE_DEADLINES.map((d) => (d.id === 'periodo-prova' ? { ...d, date: '2027-03-11', endDate: '2027-04-08' } : d))
    const courses = FAKE_COURSES.map((c, i) => (i === 0 ? { ...c, examDate: '2026-11-08' } : c))
    const r = layoutRuler('2026-10-27', courses, deadlines, 1100, i18nFor('it'), FAKE_GRADUATION)
    expect(r.description).toContain(`${courses[0]!.name} l’8 novembre`)
    expect(r.description).toContain('Periodo di prova dall’11 marzo all’8 aprile')
  })

  it('senza le date del periodo non lo disegna', () => {
    const r = layout(1100, '2026-10-27', FAKE_DEADLINES)
    expect(r.marks.some((m) => m.kind === 'period')).toBe(false)
    expect(r.description).toBe(
      'Da oggi alla laurea: Fisica Moderna il 13 novembre, Calcolo Numerico il 17 novembre, 3 esami a febbraio, laurea a luglio.',
    )
  })

  it('accorcia i nomi dei corsi', () => {
    expect(shortName('Fisica Moderna')).toBe('Fisica')
  })
})
