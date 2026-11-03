import { describe, expect, it } from 'vitest'
import xkb from '../test/xkb-it-basic.json'
import { charInventory } from '../test/charset'
import { keysymChar } from '../test/keysyms'
import { KEYS, ROWS, strokeFor, strokeHint } from './keyboard'
import { LAYOUT_IT, positionFor, positionsOf } from './layout-it'

/**
 * Caratteri dell'inventario che la tastiera italiana NON produce (vedi
 * charset.ts), con il perché. Il test fallisce se ne compare uno nuovo e anche
 * se uno di questi diventa raggiungibile: l'elenco deve dire il vero.
 * Oggi è vuoto: ogni carattere delle schede, delle proposte LaTeX e delle
 * lezioni ha un tasto.
 */
const UNREACHABLE: Record<string, string> = {}

const inventory = charInventory()
const chars = [...inventory.keys()].filter((c) => c !== '\n').sort()

describe('tabella dei livelli e file xkb', () => {
  it('confronta carattere per carattere con xkb it(basic) compilato', () => {
    const codes = Object.keys(xkb.tasti)
    expect(LAYOUT_IT.map((e) => e.code)).toEqual(codes)
    const problems: string[] = []
    for (const entry of LAYOUT_IT) {
      const syms = (xkb.tasti as Record<string, string[]>)[entry.code]!
      syms.forEach((sym, i) => {
        const expected = keysymChar(sym)
        if (expected === undefined) problems.push(`${entry.code} livello ${i + 1}: il keysym ${sym} non è nella mappa dei test`)
        else if (entry.levels[i] !== expected) problems.push(`${entry.code} livello ${i + 1}: la tabella ha «${entry.levels[i]}», xkb ha ${sym} «${expected}»`)
      })
    }
    expect(problems).toEqual([])
  })

  it('ogni tasto della tabella esiste nel disegno e ne ha lo stesso carattere', () => {
    for (const entry of LAYOUT_IT) {
      const key = KEYS.get(entry.key)
      expect(key, `${entry.code} → ${entry.key}`).toBeDefined()
      const [base, shifted] = entry.levels
      // i tasti con una lettera hanno la maiuscola come secondo livello e nessun carattere sopra
      expect(key!.label, entry.code).toBe(base)
      // il mockup disegna sopra la E il € (che sta al terzo livello), non la maiuscola
      if (key!.up === '€') expect(entry.levels[2], `${entry.code} sopra`).toBe('€')
      else if (key!.up) expect(shifted, `${entry.code} sopra`).toBe(key!.up)
      else if (/\p{L}/u.test(base)) expect(shifted, entry.code).toBe(base.toUpperCase())
    }
  })

  it('tutti i tasti del disegno con un carattere sono nella tabella', () => {
    const ids = new Set(LAYOUT_IT.map((e) => e.key))
    const charKeys = ROWS.flat().filter((k) => k.label.length === 1 && !'⇧⌫❖'.includes(k.label) && k.id !== 'space')
    expect(charKeys.filter((k) => !ids.has(k.id)).map((k) => k.id)).toEqual([])
    expect(ids.size).toBe(LAYOUT_IT.length)
  })
})

describe('il piano della fetta H contro xkb', () => {
  // [carattere, tasto xkb, livello, id del tasto disegnato, dito, mano]
  const plan: [string, string, number, string, string, string][] = [
    ['\\', 'TLDE', 1, '\\', 'mignolo', 'sinistra'],
    ['|', 'TLDE', 2, '\\', 'mignolo', 'sinistra'],
    ['^', 'AE12', 2, 'ì', 'mignolo', 'destra'],
    ['_', 'AB10', 2, '-', 'mignolo', 'destra'],
    ['~', 'AE12', 3, 'ì', 'mignolo', 'destra'],
    ['[', 'AD11', 3, 'è', 'mignolo', 'destra'],
    [']', 'AD12', 3, '+', 'mignolo', 'destra'],
    ['{', 'AD11', 4, 'è', 'mignolo', 'destra'],
    ['}', 'AD12', 4, '+', 'mignolo', 'destra'],
    ['@', 'AC10', 3, 'ò', 'mignolo', 'destra'],
    ['#', 'AC11', 3, 'à', 'mignolo', 'destra'],
    ['`', 'AE11', 3, "'", 'mignolo', 'destra'],
    ['$', 'AE04', 2, '4', 'indice', 'sinistra'],
    ['%', 'AE05', 2, '5', 'indice', 'sinistra'],
    ['&', 'AE06', 2, '6', 'indice', 'destra'],
    ['€', 'AD03', 3, 'e', 'medio', 'sinistra'],
  ]

  it.each(plan)('«%s» sta su %s al livello %i', (char, code, level, keyId, finger, hand) => {
    const pos = positionFor(char)
    expect(pos).toEqual({ code, key: keyId, level })
    const stroke = strokeFor(char)!
    expect(stroke.level).toBe(level)
    expect(stroke.key.id).toBe(keyId)
    expect(stroke.key.finger).toBe(finger)
    expect(stroke.key.hand).toBe(hand)
    expect(!!stroke.altGr).toBe(level >= 3)
    expect(!!stroke.shift).toBe(level === 2 || level === 4)
  })

  it('< e > stanno sul tasto a destra di Alt Gr: mignolo destro, > con lo Shift sinistro', () => {
    expect(positionFor('<')).toEqual({ code: 'LSGT', key: '<', level: 1 })
    expect(positionFor('>')).toEqual({ code: 'LSGT', key: '<', level: 2 })
    expect(strokeFor('<')).toMatchObject({ key: { id: '<', finger: 'mignolo', hand: 'destra' }, level: 1 })
    expect(strokeFor('<')!.shift).toBeUndefined()
    expect(strokeFor('>')).toMatchObject({ key: { id: '<', finger: 'mignolo', hand: 'destra' }, level: 2, shift: { id: 'lshift' } })
    expect(strokeHint('>')).toBe('«>», mignolo destro con lo Shift sinistro')
  })

  it('xkb offre anche altre vie: la tabella le conosce e il suggerimento ne sceglie una', () => {
    const where = (c: string) => positionsOf(c).map((p) => `${p.code}:${p.level}`)
    expect(where('{')).toEqual(['AE07:3', 'AD11:4'])
    expect(where('}')).toEqual(['AE10:3', 'AD12:4'])
    expect(where('[')).toEqual(['AE08:3', 'AD11:3'])
    expect(where(']')).toEqual(['AE09:3', 'AD12:3'])
    expect(where('@')).toEqual(['AD01:3', 'AC10:3'])
    expect(where('<')).toEqual(['AB01:4', 'LSGT:1'])
    expect(where('\\')).toEqual(['TLDE:1'])
    expect(where('~')).toEqual(['AE12:3'])
    expect(where('#')).toEqual(['AC11:3'])
  })

  it('caratteri che la tastiera italiana non produce', () => {
    expect(positionFor('È')).toBeNull()
    expect(positionFor('ν')).toBeNull()
    expect(strokeFor('È')).toBeNull()
  })
})

describe('Alt Gr e Shift nel suggerimento', () => {
  it('Alt Gr col pollice destro, Shift della mano opposta al quarto livello', () => {
    expect(strokeFor('[')).toMatchObject({ key: { id: 'è' }, altGr: { id: 'altgr', finger: 'pollice', hand: 'destra' } })
    expect(strokeFor('[')!.shift).toBeUndefined()
    expect(strokeFor('{')).toMatchObject({ key: { id: 'è' }, altGr: { id: 'altgr' }, shift: { id: 'lshift' } })
    expect(strokeFor('€')).toMatchObject({ key: { id: 'e' }, altGr: { id: 'altgr' } })
    expect(strokeFor('a')!.altGr).toBeUndefined()
  })

  it('lo dice a parole, con il dito giusto', () => {
    expect(strokeHint('\\')).toBe('«\\», mignolo sinistro')
    expect(strokeHint('^')).toBe('«^», mignolo destro con lo Shift sinistro')
    expect(strokeHint('~')).toBe('«~», mignolo destro con Alt Gr (pollice destro)')
    expect(strokeHint('{')).toBe('«{», mignolo destro con Alt Gr (pollice destro) e lo Shift sinistro')
    expect(strokeHint('€')).toBe('«€», medio sinistro con Alt Gr (pollice destro)')
    expect(strokeHint('>')).toBe('«>», mignolo destro con lo Shift sinistro')
    expect(strokeHint('ν')).toBe('«ν»: carattere speciale')
  })
})

describe('ogni carattere dei mazzi ha un tasto, un livello e un dito', () => {
  it('l’inventario non è vuoto e contiene i caratteri del LaTeX', () => {
    expect(inventory.size).toBeGreaterThan(40)
    for (const c of ['\\', '{', '}', '^', '_']) expect(inventory.has(c), c).toBe(true)
  })

  it('nessun carattere resta senza posto, salvo quelli dichiarati', () => {
    const unresolved = chars.filter((c) => !strokeFor(c))
    const report = unresolved.map((c) => {
      const o = inventory.get(c)!
      return `«${c}» (U+${c.codePointAt(0)!.toString(16).toUpperCase()}) ${o.count} volte ${JSON.stringify(o.bySource)}, schede ${o.cards.join(', ')}`
    })
    if (report.length) console.warn(`Caratteri non raggiungibili:\n${report.join('\n')}`)
    expect(unresolved).toEqual(Object.keys(UNREACHABLE).sort())
    for (const c of Object.keys(UNREACHABLE)) expect(strokeFor(c), `«${c}» ora è raggiungibile: toglilo dall’elenco`).toBeNull()
  })

  it('ogni carattere risolto ha livello, tasto e dito', () => {
    for (const c of chars) {
      const stroke = strokeFor(c)
      if (!stroke) continue
      expect([1, 2, 3, 4], c).toContain(stroke.level)
      expect(stroke.key.id.length).toBeGreaterThan(0)
      expect(stroke.key.finger, `${c} dito`).not.toBeNull()
      expect(stroke.key.hand, c).toMatch(/^(sinistra|destra)$/)
      // Shift e Alt Gr coerenti con il livello
      expect(!!stroke.shift, `${c} shift`).toBe(stroke.level === 2 || stroke.level === 4)
      expect(!!stroke.altGr, `${c} altgr`).toBe(stroke.level >= 3)
      if (c !== ' ') expect(strokeHint(c)).toContain(`«${c}»`)
    }
  })

  it('stampa l’inventario con INVENTORY=1', () => {
    // Node non è nei tipi del progetto: si legge l'ambiente senza dichiararlo.
    if (!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.INVENTORY) return
    const rows = chars
      .map((c) => ({ c, o: inventory.get(c)! }))
      .sort((a, b) => b.o.count - a.o.count)
      .map(({ c, o }) => {
        const s = strokeFor(c)
        const where = s ? `${s.key.id} liv.${s.level} ${s.key.finger} ${s.key.hand}` : 'NON RAGGIUNGIBILE'
        return `${JSON.stringify(c).padEnd(6)} ${String(o.count).padStart(6)}  ${where.padEnd(34)} ${JSON.stringify(o.bySource)}`
      })
    console.log(`${chars.length} caratteri distinti\n${rows.join('\n')}`)
  })
})
