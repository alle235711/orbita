import { describe, expect, it } from 'vitest'
import { TEX_CHAPTER, TEX_GOOD, TEX_MALFORMED } from '../test/tex-fixtures'
import { parseTexFiles } from './parse'
import { previewRows, texCardId, texContentFile, texSummary } from './plan'

const results = parseTexFiles([
  { name: 'main.tex', text: TEX_GOOD },
  { name: 'cap2.tex', text: TEX_CHAPTER },
  { name: 'rotto.tex', text: TEX_MALFORMED },
])

describe('anteprima e importazione', () => {
  it('una riga per scheda, con chiavi diverse', () => {
    const rows = previewRows(results)
    expect(rows).toHaveLength(results.reduce((n, r) => n + r.cards.length, 0))
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length)
  })

  it('gli id sono deterministici: stesso corso, file, ambiente e progressivo', () => {
    const a = previewRows(results).map((r) => texCardId('analisi', r))
    const b = previewRows(parseTexFiles([
      { name: 'main.tex', text: TEX_GOOD },
      { name: 'cap2.tex', text: TEX_CHAPTER },
      { name: 'rotto.tex', text: TEX_MALFORMED },
    ])).map((r) => texCardId('analisi', r))
    expect(a).toEqual(b)
    expect(new Set(a).size).toBe(a.length)
    expect(a[0]).toBe('tex:analisi:main.tex:definizione:1')
    expect(texCardId('altro', previewRows(results)[0]!)).not.toBe(a[0])
  })

  it('due file con lo stesso nome non si pestano gli id', () => {
    const twin = previewRows(parseTexFiles([
      { name: 'a.tex', text: TEX_CHAPTER },
      { name: 'a.tex', text: TEX_CHAPTER },
    ]))
    const ids = twin.map((r) => texCardId('c', r))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('il file di schede ha la chiave vuota e riferisce il corso', () => {
    const rows = previewRows(results).slice(0, 3)
    const file = texContentFile('analisi', rows, '2026-11-03')
    expect(file.corsi).toEqual([])
    expect(file.schede).toHaveLength(3)
    for (const [i, s] of file.schede.entries()) {
      expect(s).toMatchObject({ corso: 'analisi', chiave: '', titolo: rows[i]!.card.title, sezione: rows[i]!.card.section, testo: rows[i]!.card.text })
    }
  })

  it('il riepilogo conta file, schede ed errori', () => {
    const s = texSummary(results)
    expect(s.files).toBe(3)
    expect(s.cards).toBe(previewRows(results).length)
    expect(s.errors).toBe(results.flatMap((r) => r.errors).length)
    expect(s.errors).toBeGreaterThan(0)
  })
})
