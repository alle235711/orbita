import { describe, expect, it } from 'vitest'
import { renderError } from '../i18n/errors'
import { i18nFor } from '../i18n'
import { card, course, deck, manyCards } from '../test/deck-fixtures'
import { buildDeckFile } from './file'
import { compressDeck, compressionSupported, decompressDeck, deckBytes, deckToOrbita, deckToPayload, deflateRaw, fromBase64Url, inflateRaw, isOrbita, MAX_DECK_BYTES, orbitaToDeck, PAYLOAD_PREFIX, payloadToDeck, readDeckBytes, toBase64Url } from './pack'

const small = () => buildDeckFile(deck(), course(), [card('a'), card('b', { formulaReading: 'x con n' })], '2026-11-03')
const big = () => buildDeckFile(deck(), course(), manyCards(60), '2026-11-03')

const failure = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p
  } catch (e) {
    return renderError(e, i18nFor('it'))
  }
  return ''
}

describe('compressione nativa', () => {
  it('c’è deflate-raw in questo ambiente', () => {
    expect(compressionSupported()).toBe(true)
  })

  it('deflate e inflate sono inversi, anche con byte qualunque', async () => {
    const bytes = new Uint8Array(5000).map((_, i) => (i * 7 + (i >> 3)) & 255)
    expect(await inflateRaw(await deflateRaw(bytes))).toEqual(bytes)
    expect(await inflateRaw(await deflateRaw(new Uint8Array()))).toEqual(new Uint8Array())
  })

  it('rifiuta un flusso rovinato o gonfiato oltre il limite', async () => {
    expect(await failure(inflateRaw(new Uint8Array([1, 2, 3, 4, 5])))).toMatch(/danneggiato o incompleto/)
    const bomb = await deflateRaw(new Uint8Array(MAX_DECK_BYTES + 1))
    expect(bomb.length).toBeLessThan(50_000)
    expect(await failure(inflateRaw(bomb))).toMatch(/danneggiato o incompleto/)
  })
})

describe('base64url', () => {
  it('ciclo identico per ogni lunghezza (resto 0, 1, 2) e usa solo l’alfabeto url', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = new Uint8Array(n).map((_, i) => (i * 37 + n * 11 + 250) & 255)
      const text = toBase64Url(bytes)
      expect(text).toMatch(/^[A-Za-z0-9_-]*$/)
      expect(fromBase64Url(text)).toEqual(bytes)
    }
    expect(toBase64Url(new Uint8Array([0xfb, 0xff, 0xfe]))).toBe('-__-')
  })

  it('coincide con btoa del browser, senza riempimento', () => {
    const bytes = new Uint8Array(100).map((_, i) => i * 3)
    expect(toBase64Url(bytes)).toBe(btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''))
  })

  it('rifiuta caratteri fuori alfabeto e lunghezze impossibili', () => {
    for (const bad of ['ab+/', 'ab=', 'a b', 'abcde', 'é']) expect(() => fromBase64Url(bad)).toThrow()
  })
})

describe('file .orbita', () => {
  it('ciclo identico: mazzo → .orbita → mazzo', async () => {
    const f = small()
    const bytes = await deckToOrbita(f)
    expect(isOrbita(bytes)).toBe(true)
    expect([...bytes.subarray(0, 4)]).toEqual([0x4f, 0x52, 0x42, 1])
    expect(await orbitaToDeck(bytes)).toEqual(f)
    expect(await readDeckBytes(bytes, 'x.orbita')).toEqual(f)
  })

  it('il JSON in chiaro si legge con la stessa funzione', async () => {
    const f = small()
    expect(await readDeckBytes(new TextEncoder().encode(JSON.stringify(f, null, 1)), 'x.json')).toEqual(f)
  })

  it('un mazzo vero è molto più piccolo compresso (ma non magia)', async () => {
    const f = big()
    const packed = await compressDeck(f)
    expect(packed.length).toBeLessThan(deckBytes(f).length)
  })

  it('errori chiari: JSON rotto, magic giusto ma corpo rotto, versione futura, magic sbagliato', async () => {
    const enc = (s: string) => new TextEncoder().encode(s)
    expect(await failure(readDeckBytes(enc('{non json'), 'rotto.json'))).toBe('rotto.json non è un file JSON valido.')
    expect(await failure(readDeckBytes(enc('{"a":1}'), 'altro.json'))).toBe('Il file non è un mazzo di Orbita.')
    const good = await deckToOrbita(small())
    expect(await failure(orbitaToDeck(good.subarray(0, 12)))).toMatch(/danneggiato o incompleto/)
    expect(await failure(orbitaToDeck(new Uint8Array([0x4f, 0x52, 0x42, 1])))).toMatch(/danneggiato o incompleto|non è un mazzo/)
    const future = good.slice()
    future[3] = 2
    expect(await failure(orbitaToDeck(future))).toMatch(/versione più nuova/)
    const zero = good.slice()
    zero[3] = 0
    expect(await failure(orbitaToDeck(zero))).toMatch(/non è un mazzo/)
    expect(await failure(orbitaToDeck(enc('PK\u0003\u0004zip')))).toMatch(/non è un mazzo/)
  })

  it('un compresso valido che non è un mazzo dà errore, non un mazzo vuoto', async () => {
    const notDeck = await deflateRaw(new TextEncoder().encode('{"app":"orbita","tipo":"backup"}'))
    expect(await failure(decompressDeck(notDeck))).toBe('Il file non è un mazzo di Orbita.')
    const notJson = await deflateRaw(new Uint8Array([0xff, 0xfe, 0xfd]))
    expect(await failure(decompressDeck(notJson))).toMatch(/danneggiato o incompleto/)
  })
})

describe('payload del QR', () => {
  it('ha il prefisso con la versione e solo caratteri base64url', async () => {
    const payload = await deckToPayload(small())
    expect(payload.startsWith('ORB1:')).toBe(true)
    expect(PAYLOAD_PREFIX).toBe('ORB1:')
    expect(payload.slice(5)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('ciclo identico: mazzo → payload → mazzo, anche per un mazzo grande', async () => {
    for (const f of [small(), big()]) expect(await payloadToDeck(await deckToPayload(f))).toEqual(f)
  })

  it('il payload è lo stesso compresso del file .orbita', async () => {
    const f = small()
    const orbita = await deckToOrbita(f)
    expect((await deckToPayload(f)).slice(5)).toBe(toBase64Url(orbita.subarray(4)))
  })

  it('prefisso sconosciuto, versione futura, corpo rovinato: errori chiari', async () => {
    const payload = await deckToPayload(small())
    expect(await failure(payloadToDeck('https://esempio.it/x'))).toBe('Il file non è un mazzo di Orbita.')
    expect(await failure(payloadToDeck(''))).toBe('Il file non è un mazzo di Orbita.')
    expect(await failure(payloadToDeck(payload.replace('ORB1:', 'ORB2:')))).toMatch(/versione più nuova/)
    expect(await failure(payloadToDeck(payload.replace('ORB1:', 'ORB0:')))).toMatch(/non è un mazzo/)
    expect(await failure(payloadToDeck(payload.slice(0, 20)))).toMatch(/danneggiato o incompleto/)
    expect(await failure(payloadToDeck('ORB1:!!!!'))).toMatch(/danneggiato o incompleto/)
  })
})
