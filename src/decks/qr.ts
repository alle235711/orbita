// Il QR di un mazzo: si genera solo se il payload ci sta davvero, con una soglia conservativa.
//
// Soglia: livello di correzione M (recupera fino al ~15% di moduli rovinati: riflessi, polvere, uno
// schermo non perfetto) e versione massima 20 (97x97 moduli). Un QR più denso si legge male da uno
// schermo a una certa distanza. La capacità non si inventa: viene dalla tabella dello standard
// (ISO/IEC 18004, versione 20-M = 669 codeword di dati) e dalla modalità a byte (4 bit di modo + 16
// bit di lunghezza per le versioni 10-40), cioè floor((669*8 - 20) / 8) = 666 byte. Il test controlla
// che la libreria accetti 666 byte in versione 20 e ne rifiuti 667. Per cambiare soglia: QR_MAX_VERSION
// e la sua riga in DATA_CODEWORDS_M (versione 25 = 997 byte, 30 = 1370, 40 = 2331).

import qrcode from 'qrcode-generator'

export const QR_ECC = 'M'
export const QR_MAX_VERSION = 20
/** Codeword di dati per versione, livello M (ISO/IEC 18004). Solo le versioni che ci servono. */
const DATA_CODEWORDS_M: Record<number, number> = { 10: 216, 15: 415, 20: 669, 25: 1000, 30: 1373 }
const BYTE_MODE_OVERHEAD_BITS = 4 + 16

export function qrCapacityBytes(version: number): number {
  const words = DATA_CODEWORDS_M[version]
  if (!words) throw new Error(`versione ${version} non in tabella`)
  return Math.floor((words * 8 - BYTE_MODE_OVERHEAD_BITS) / 8)
}

/** Quanti byte di payload ci stanno al massimo: la soglia. */
export const QR_MAX_BYTES = qrCapacityBytes(QR_MAX_VERSION)

export type QrFit = { fits: true; bytes: number; version: number; modules: number } | { fits: false; bytes: number; max: number }

const versionOf = (modules: number) => (modules - 17) / 4

/** Il payload (testo ASCII) ci sta nel QR? Non genera nulla se non ci sta. */
export function qrFit(payload: string): QrFit {
  const bytes = payload.length
  if (bytes > QR_MAX_BYTES) return { fits: false, bytes, max: QR_MAX_BYTES }
  const modules = buildQr(payload).getModuleCount()
  return { fits: true, bytes, version: versionOf(modules), modules }
}

function buildQr(payload: string) {
  const qr = qrcode(0, QR_ECC)
  qr.addData(payload, 'Byte')
  qr.make()
  return qr
}

/** La matrice del QR (true = modulo scuro), senza il bordo bianco. Lancia se il payload non ci sta. */
export function qrMatrix(payload: string): boolean[][] {
  const fit = qrFit(payload)
  if (!fit.fits) throw new RangeError(`payload di ${fit.bytes} byte: oltre i ${fit.max} del QR`)
  const qr = buildQr(payload)
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}
