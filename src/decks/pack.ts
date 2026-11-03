// Compressione e codifica del mazzo, tutto nativo e offline (CompressionStream 'deflate-raw').
//
// Un solo compresso, due involucri:
// - file `.orbita`: byte 'O' 'R' 'B', poi il byte della versione dell'involucro (1), poi il deflate-raw
//   del JSON del mazzo in UTF-8;
// - payload del QR: testo ASCII `ORB1:` + base64url (senza riempimento) degli stessi byte compressi.
// Il prefisso `ORB<n>` è la versione dell'involucro; la `versione` dentro il JSON è quella del mazzo.

import { AppError } from '../i18n/errors'
import { parseDeckFile, type DeckFile } from './file'

export const PACK_VERSION = 1
const MAGIC = [0x4f, 0x52, 0x42] as const
export const PAYLOAD_PREFIX = `ORB${PACK_VERSION}:`
/** Un mazzo decompresso più grande di così non è un mazzo: protegge da file compressi gonfiati ad arte. */
export const MAX_DECK_BYTES = 20 * 1024 * 1024

/** Il browser sa comprimere e decomprimere in 'deflate-raw'? (Safari dalla 16.4.) */
export function compressionSupported(): boolean {
  try {
    new CompressionStream('deflate-raw')
    new DecompressionStream('deflate-raw')
    return true
  } catch {
    return false
  }
}

async function run(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new AppError('deckCorrupt')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

export async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (!compressionSupported()) throw new AppError('deckNoCompression')
  return run(bytes, new CompressionStream('deflate-raw'), Number.MAX_SAFE_INTEGER)
}

export async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (!compressionSupported()) throw new AppError('deckNoCompression')
  try {
    return await run(bytes, new DecompressionStream('deflate-raw'), MAX_DECK_BYTES)
  } catch (e) {
    throw e instanceof AppError ? e : new AppError('deckCorrupt')
  }
}

const ENCODER = new TextEncoder()
const DECODER = new TextDecoder('utf-8', { fatal: true })

/** Il JSON compatto del mazzo, in UTF-8. */
export const deckBytes = (file: DeckFile): Uint8Array => ENCODER.encode(JSON.stringify(file))

/** I byte compressi del mazzo (il contenuto comune a file e QR). */
export const compressDeck = (file: DeckFile): Promise<Uint8Array> => deflateRaw(deckBytes(file))

/** Da byte decompressi al mazzo controllato; qualunque cosa non sia un mazzo valido è `deckCorrupt` o l'errore del formato. */
function bytesToDeck(raw: Uint8Array): DeckFile {
  let json: unknown
  try {
    json = JSON.parse(DECODER.decode(raw))
  } catch {
    throw new AppError('deckCorrupt')
  }
  return parseDeckFile(json)
}

export async function decompressDeck(compressed: Uint8Array): Promise<DeckFile> {
  return bytesToDeck(await inflateRaw(compressed))
}

// ---- file .orbita

export async function deckToOrbita(file: DeckFile): Promise<Uint8Array> {
  const body = await compressDeck(file)
  const out = new Uint8Array(MAGIC.length + 1 + body.length)
  out.set(MAGIC, 0)
  out[MAGIC.length] = PACK_VERSION
  out.set(body, MAGIC.length + 1)
  return out
}

/** I byte cominciano come un file .orbita? */
export const isOrbita = (bytes: Uint8Array): boolean => MAGIC.every((b, i) => bytes[i] === b)

export async function orbitaToDeck(bytes: Uint8Array): Promise<DeckFile> {
  if (!isOrbita(bytes) || bytes.length <= MAGIC.length) throw new AppError('deckNotDeck')
  if (bytes[MAGIC.length]! > PACK_VERSION) throw new AppError('deckTooNew')
  if (bytes[MAGIC.length] !== PACK_VERSION) throw new AppError('deckNotDeck')
  return decompressDeck(bytes.subarray(MAGIC.length + 1))
}

/** Da un file scelto dall'utente (JSON in chiaro o .orbita) al mazzo controllato. */
export async function readDeckBytes(bytes: Uint8Array, name: string): Promise<DeckFile> {
  if (isOrbita(bytes)) return orbitaToDeck(bytes)
  let json: unknown
  try {
    json = JSON.parse(DECODER.decode(bytes))
  } catch {
    throw new AppError('invalidJson', { name })
  }
  return parseDeckFile(json)
}

// ---- payload del QR

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export function toBase64Url(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    if (i + 1 < bytes.length) out += B64[(n >> 6) & 63]!
    if (i + 2 < bytes.length) out += B64[n & 63]!
  }
  return out
}

/** Decodifica rigorosa: solo l'alfabeto base64url, e una lunghezza possibile. Altrimenti `deckCorrupt`. */
export function fromBase64Url(text: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new AppError('deckCorrupt')
  const out = new Uint8Array(Math.floor((text.length * 6) / 8))
  let bits = 0
  let acc = 0
  let at = 0
  for (const ch of text) {
    acc = (acc << 6) | B64.indexOf(ch)
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[at++] = (acc >> bits) & 255
      acc &= (1 << bits) - 1
    }
  }
  return out
}

/** Il testo che finisce nel QR: `ORB1:` + base64url del mazzo compresso. */
export async function deckToPayload(file: DeckFile): Promise<string> {
  return PAYLOAD_PREFIX + toBase64Url(await compressDeck(file))
}

/** L'inverso: dal testo letto da un QR al mazzo. Prefisso sconosciuto o versione più nuova = errore chiaro. */
export async function payloadToDeck(payload: string): Promise<DeckFile> {
  const m = /^ORB(\d+):/.exec(payload)
  if (!m) throw new AppError('deckNotDeck')
  if (Number(m[1]) > PACK_VERSION) throw new AppError('deckTooNew')
  if (Number(m[1]) !== PACK_VERSION) throw new AppError('deckNotDeck')
  return decompressDeck(fromBase64Url(payload.slice(m[0].length)))
}
