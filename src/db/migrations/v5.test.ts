import { describe, expect, it } from 'vitest'
import { parseBackup } from '../backup'
import { migrateCardsV5, normalizeCardV5 } from './v5'
import type { RawRow } from './v2'

const card = (extra: Record<string, unknown> = {}): RawRow => ({
  id: 'c1',
  courseId: 'k',
  section: 'S',
  kind: 'definizione',
  title: 'T',
  text: 'Vale $E_n$.',
  key: 'E_n',
  needsFix: false,
  userEdited: false,
  updatedAt: 7,
  ...extra,
})

describe('normalizeCardV5', () => {
  it('una scheda senza lettura resta la stessa riga', () => {
    const row = card()
    expect(normalizeCardV5(row)).toBe(row)
  })

  it('una lettura già pulita resta la stessa riga', () => {
    const row = card({ formulaReading: 'E con n' })
    expect(normalizeCardV5(row)).toBe(row)
  })

  it('toglie gli spazi ai bordi e cancella la lettura vuota o non testuale', () => {
    expect(normalizeCardV5(card({ formulaReading: '  E con n  ' }))).toEqual(card({ formulaReading: 'E con n' }))
    expect(normalizeCardV5(card({ formulaReading: '   ' }))).toEqual(card())
    expect(normalizeCardV5(card({ formulaReading: 42 }))).toEqual(card())
    expect('formulaReading' in normalizeCardV5(card({ formulaReading: '' }))).toBe(false)
  })

  it('letturaFormula diventa formulaReading, ma non sovrascrive quella che c’è', () => {
    expect(normalizeCardV5(card({ letturaFormula: 'E con n' }))).toEqual(card({ formulaReading: 'E con n' }))
    expect(normalizeCardV5(card({ letturaFormula: 'vecchia', formulaReading: 'nuova' }))).toEqual(card({ formulaReading: 'nuova' }))
    expect(normalizeCardV5(card({ letturaFormula: '' }))).toEqual(card())
  })

  it('non cambia updatedAt né gli altri campi', () => {
    const out = normalizeCardV5(card({ formulaReading: ' x ', userEdited: true, updatedAt: 99 }))
    expect(out).toMatchObject({ updatedAt: 99, userEdited: true, text: 'Vale $E_n$.' })
  })
})

describe('migrateCardsV5', () => {
  const rows = [card(), card({ id: 'c2', letturaFormula: ' a ' }), card({ id: 'c3', formulaReading: 'b' })]

  it('non modifica l’ingresso ed è idempotente e deterministica', () => {
    const copy = structuredClone(rows)
    const once = migrateCardsV5(rows)
    expect(rows).toEqual(copy)
    expect(migrateCardsV5(once)).toEqual(once)
    expect(migrateCardsV5(rows)).toEqual(once)
    expect(once.map((r) => r.formulaReading)).toEqual([undefined, 'a', 'b'])
  })

  it('un backup passa dalla stessa normalizzazione', () => {
    const backup = parseBackup({ app: 'orbita', format: 2, exportedAt: '', tables: { cards: structuredClone(rows) } })
    expect(backup.tables.cards).toEqual(migrateCardsV5(rows))
    expect(backup.tables.cards![1]).not.toHaveProperty('letturaFormula')
  })
})
