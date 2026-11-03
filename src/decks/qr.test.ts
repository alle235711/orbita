import qrcode from 'qrcode-generator'
import { describe, expect, it } from 'vitest'
import content from '../../content/schede-2026-27.json'
import type { Card } from '../db/schema'
import { card, course, deck, manyCards } from '../test/deck-fixtures'
import { buildDeckFile } from './file'
import { deckToPayload } from './pack'
import { QR_ECC, QR_MAX_BYTES, QR_MAX_VERSION, qrCapacityBytes, qrFit, qrMatrix } from './qr'

/** Il massimo di byte che la libreria mette davvero in una versione e livello dati (cerca per tentativi). */
function libraryCapacity(version: number, ecc: 'L' | 'M' | 'Q' | 'H'): number {
  let lo = 0
  let hi = 3000
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    try {
      const q = qrcode(version as never, ecc)
      q.addData('a'.repeat(mid), 'Byte')
      q.make()
      lo = mid
    } catch {
      hi = mid - 1
    }
  }
  return lo
}

describe('soglia del QR', () => {
  it('è una scelta conservativa e documentata: livello M, versione 20, 666 byte', () => {
    expect(QR_ECC).toBe('M')
    expect(QR_MAX_VERSION).toBe(20)
    expect(QR_MAX_BYTES).toBe(666)
  })

  it('la capacità calcolata dalla tabella coincide con quella vera della libreria, versione per versione', () => {
    for (const v of [10, 15, 20, 25, 30]) expect(qrCapacityBytes(v)).toBe(libraryCapacity(v, 'M'))
  })

  it('caso limite: 666 byte ci stanno nella versione 20, 667 no', () => {
    const at = qrFit('a'.repeat(666))
    expect(at).toMatchObject({ fits: true, bytes: 666, version: 20, modules: 97 })
    expect(qrFit('a'.repeat(667))).toEqual({ fits: false, bytes: 667, max: 666 })
    // e la libreria concorda: a 667 non basta la versione 20
    expect(() => {
      const q = qrcode(20, 'M')
      q.addData('a'.repeat(667), 'Byte')
      q.make()
    }).toThrow()
  })

  it('un payload piccolo usa una versione piccola; mai oltre la 20', () => {
    const fit = qrFit('ORB1:abc')
    expect(fit.fits && fit.version).toBeLessThan(5)
    for (const n of [1, 100, 300, 500, 666]) {
      const r = qrFit('b'.repeat(n))
      expect(r.fits && r.version).toBeLessThanOrEqual(20)
    }
  })

  it('sopra la soglia non si genera nulla: la matrice rifiuta, con il numero di byte', () => {
    expect(() => qrMatrix('a'.repeat(667))).toThrow(/667 byte/)
  })

  it('la matrice è quadrata, ha i tre riquadri di posizione e dipende dal contenuto', () => {
    const m = qrMatrix('ORB1:abcdef')
    const n = m.length
    expect(m.every((row) => row.length === n)).toBe(true)
    expect((n - 17) % 4).toBe(0)
    // angoli dei riquadri di posizione: 7x7 con bordo scuro
    for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]] as const) {
      for (let i = 0; i < 7; i++) {
        expect(m[r]![c + i]).toBe(true)
        expect(m[r + 6]![c + i]).toBe(true)
        expect(m[r + i]![c]).toBe(true)
        expect(m[r + i]![c + 6]).toBe(true)
      }
    }
    expect(qrMatrix('ORB1:abcdeg')).not.toEqual(m)
  })
})

describe('mazzi veri contro la soglia', () => {
  it('un mazzo di poche schede brevi ci sta; uno di sessanta no, e dice quanti byte', async () => {
    const small = buildDeckFile(deck(), course(), [card('a', { text: 'Vale $x$.', title: 'A', key: '' }), card('b', { text: 'Vale $y$.', title: 'B', key: '' })], '2026-11-03')
    const fit = qrFit(await deckToPayload(small))
    expect(fit.fits).toBe(true)
    const big = qrFit(await deckToPayload(buildDeckFile(deck(), course(), manyCards(60), '2026-11-03')))
    expect(big.fits).toBe(false)
    if (!big.fits) {
      expect(big.bytes).toBeGreaterThan(666)
      expect(big.max).toBe(666)
    }
  })
})

describe('le schede incluse (content/schede-2026-27.json) contro la soglia', () => {
  const cardsOf = (courseId: string): Card[] =>
    content.schede
      .filter((s) => s.corso === courseId)
      .map((s) => ({ id: s.id, courseId: 'c1', section: s.sezione, kind: s.tipo, title: s.titolo, text: s.testo, key: s.chiave, needsFix: false, userEdited: false, updatedAt: 0 }))

  it('un corso intero (150-190 schede) non ci sta mai: il QR è per mazzi minuscoli', async () => {
    for (const c of content.corsi) {
      const fit = qrFit(await deckToPayload(buildDeckFile(deck(), course(), cardsOf(c.id), '2026-11-03')))
      expect(fit.fits).toBe(false)
      if (!fit.fits) expect(fit.bytes).toBeGreaterThan(10_000)
    }
  })

  it('una sola scheda vera ci sta, con la sua intestazione', async () => {
    const first = content.corsi[0]!.id
    const fit = qrFit(await deckToPayload(buildDeckFile(deck(), course(), cardsOf(first).slice(0, 1), '2026-11-03')))
    expect(fit.fits).toBe(true)
  })
})
