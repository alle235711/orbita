// Tastiera del portatile HP 250 G8, layout italiano (SPEC §5), con la mappa
// delle dita del mockup Rivista-Ripasso. Le larghezze sono quelle del mockup
// in pixel (tasto normale 50, spazio fra i tasti 6): ogni riga fa 840.

export type Finger = 'mignolo' | 'anulare' | 'medio' | 'indice' | 'pollice'
export type Hand = 'sinistra' | 'destra'

export interface Key {
  id: string
  /** Etichetta grande (carattere senza Shift). */
  label: string
  /** Carattere con Shift, in piccolo sopra. */
  up?: string
  finger: Finger | null
  hand: Hand
  width: number
  /** Rilievo per le dita indici (f e j). */
  bump?: boolean
}

const k = (id: string, finger: Finger | null, hand: Hand, opts: Partial<Omit<Key, 'id' | 'finger' | 'hand'>> = {}): Key => ({
  id,
  label: opts.label ?? id,
  up: opts.up,
  finger,
  hand,
  width: opts.width ?? 50,
  bump: opts.bump,
})

const L: Hand = 'sinistra'
const R: Hand = 'destra'

export const ROWS: Key[][] = [
  [
    k('\\', 'mignolo', L, { up: '|' }),
    k('1', 'mignolo', L, { up: '!' }),
    k('2', 'anulare', L, { up: '"' }),
    k('3', 'medio', L, { up: '£' }),
    k('4', 'indice', L, { up: '$' }),
    k('5', 'indice', L, { up: '%' }),
    k('6', 'indice', R, { up: '&' }),
    k('7', 'indice', R, { up: '/' }),
    k('8', 'medio', R, { up: '(' }),
    k('9', 'anulare', R, { up: ')' }),
    k('0', 'mignolo', R, { up: '=' }),
    k("'", 'mignolo', R, { up: '?' }),
    k('ì', 'mignolo', R, { up: '^' }),
    k('back', 'mignolo', R, { label: '⌫', width: 112 }),
  ],
  [
    k('tab', 'mignolo', L, { label: 'Tab', width: 80 }),
    k('q', 'mignolo', L),
    k('w', 'anulare', L),
    k('e', 'medio', L, { up: '€' }),
    k('r', 'indice', L),
    k('t', 'indice', L),
    k('y', 'indice', R),
    k('u', 'indice', R),
    k('i', 'medio', R),
    k('o', 'anulare', R),
    k('p', 'mignolo', R),
    k('è', 'mignolo', R, { up: 'é' }),
    k('+', 'mignolo', R, { up: '*' }),
    k('ù', 'mignolo', R, { up: '§', width: 82 }),
  ],
  [
    k('caps', 'mignolo', L, { label: 'Bloc Maiusc', width: 92 }),
    k('a', 'mignolo', L),
    k('s', 'anulare', L),
    k('d', 'medio', L),
    k('f', 'indice', L, { bump: true }),
    k('g', 'indice', L),
    k('h', 'indice', R),
    k('j', 'indice', R, { bump: true }),
    k('k', 'medio', R),
    k('l', 'anulare', R),
    k('ò', 'mignolo', R, { up: 'ç' }),
    k('à', 'mignolo', R, { up: '°' }),
    k('enter', 'mignolo', R, { label: 'Invio', width: 126 }),
  ],
  [
    k('lshift', 'mignolo', L, { label: '⇧', width: 120 }),
    k('z', 'mignolo', L),
    k('x', 'anulare', L),
    k('c', 'medio', L),
    k('v', 'indice', L),
    k('b', 'indice', L),
    k('n', 'indice', R),
    k('m', 'indice', R),
    k(',', 'medio', R, { up: ';' }),
    k('.', 'anulare', R, { up: ':' }),
    k('-', 'mignolo', R, { up: '_' }),
    k('rshift', 'mignolo', R, { label: '⇧', width: 154 }),
  ],
  [
    k('ctrl', null, L, { label: 'ctrl', width: 62 }),
    k('fn', null, L, { label: 'fn' }),
    k('super', null, L, { label: '❖' }),
    k('alt', 'pollice', L, { label: 'alt' }),
    k('space', 'pollice', R, { label: '', width: 330 }),
    k('altgr', 'pollice', R, { label: 'alt gr', width: 62 }),
    k('<', null, R, { up: '>' }),
  ],
]

export const KEYS: Map<string, Key> = new Map(ROWS.flat().map((key) => [key.id, key]))

/** Tasti con un carattere sopra: il carattere con Shift → il tasto. */
const SHIFTED: Map<string, string> = new Map(
  ROWS.flat()
    .filter((key) => key.up && key.up !== '€')
    .map((key) => [key.up!, key.id]),
)

export interface Stroke {
  key: Key
  /** Lo Shift da tenere premuto, quello della mano opposta. */
  shift?: Key
}

/** Come si scrive un carattere: tasto, dito e Shift; null se serve Alt Gr o non c'è. */
export function strokeFor(char: string): Stroke | null {
  if (char === ' ') return { key: KEYS.get('space')! }
  const direct = KEYS.get(char)
  if (direct && direct.label === char) return { key: direct }
  const shifted = SHIFTED.get(char)
  const lower = char.toLowerCase()
  const keyId = shifted ?? (lower !== char && KEYS.has(lower) ? lower : undefined)
  if (!keyId) return null
  const key = KEYS.get(keyId)!
  return { key, shift: KEYS.get(key.hand === 'sinistra' ? 'rshift' : 'lshift')! }
}

const FINGER_LABEL: Record<Finger, string> = {
  mignolo: 'mignolo',
  anulare: 'anulare',
  medio: 'medio',
  indice: 'indice',
  pollice: 'pollice',
}

/** «e», medio sinistro · «E», medio sinistro con lo Shift destro · Spazio, col pollice */
export function strokeHint(char: string): string {
  if (char === ' ') return 'Spazio, col pollice'
  const stroke = strokeFor(char)
  if (!stroke) return `«${char}»: carattere speciale`
  const { key, shift } = stroke
  if (!key.finger) return `«${char}», tasto in basso a destra accanto ad alt gr${shift ? ', con lo Shift sinistro' : ''}`
  const hand = key.hand === 'sinistra' ? 'sinistro' : 'destro'
  const base = `«${char}», ${FINGER_LABEL[key.finger]} ${hand}`
  return shift ? `${base} con lo Shift ${shift.id === 'rshift' ? 'destro' : 'sinistro'}` : base
}

/** Il tasto da premere per un carattere (per le statistiche di errore). */
export function keyIdFor(char: string): string | null {
  return strokeFor(char)?.key.id ?? null
}
