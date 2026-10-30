import { describe, expect, it } from 'vitest'

// Guardia: nei componenti il testo visibile viene dal dizionario, mai scritto
// a mano. Il compilatore di TypeScript non è usabile qui, quindi si legge il
// sorgente con un piccolo analizzatore: via i commenti, via il contenuto delle
// stringhe, poi si cercano i testi del JSX e gli attributi con parole.

// Vite legge i sorgenti come testo: niente tipi di Node nel progetto.
const SOURCES = import.meta.glob<string>('/src/{features,components,app,art}/**/*.tsx', { query: '?raw', import: 'default', eager: true })

/** Parole ammesse scritte a mano, ciascuna col suo motivo. */
const ALLOWED_TEXT = new Set([
  'Orbita', // il nome del marchio non si traduce
  // Notazione sulla lavagna (art/): simboli e nomi propri, uguali in ogni lingua.
  'Lyman α',
  'Hα',
  'Hβ',
  '⋯ → C₂ → C₁ → C₀ → 0',
  'a',
  'b',
  'L',
  '← T',
  'Gibbs', // fenomeno di Gibbs: nome proprio
])

/** Parole di codice TypeScript: se compaiono, il pezzo non è testo del JSX. */
const CODE_WORD = /\b(try|interface|const|let|return|else|catch|export|function|import|Promise|Record|extends|async|await)\b/

const LETTER = /[A-Za-zÀ-ÿ]/
const ATTRS = ['aria-label', 'aria-description', 'aria-roledescription', 'placeholder', 'title', 'alt', 'label']

const files = Object.keys(SOURCES).sort()

/** Toglie i commenti, tenendo le righe (e quindi i numeri di riga) al loro posto. */
function stripComments(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    .replace(/(^|[\s;{}(,])\/\/[^\n]*/g, (m, lead: string) => lead + blank(m.slice(lead.length)))
}

/** Svuota il contenuto delle stringhe tra apici e dei modelli (apici e a capo restano). */
function maskStrings(src: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, ' ')
  return src
    .replace(/`(?:[^`\\]|\\.)*`/g, (m) => '`' + blank(m.slice(1, -1)) + '`')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, (m) => `'${' '.repeat(m.length - 2)}'`)
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => `"${' '.repeat(m.length - 2)}"`)
}

const lineOf = (src: string, index: number) => src.slice(0, index).split('\n').length

interface Hit {
  file: string
  line: number
  text: string
}

function scan(file: string): Hit[] {
  const src = stripComments(SOURCES[file]!)
  const rel = file.replace('/src/', '')
  const hits: Hit[] = []
  const add = (index: number, text: string) => {
    if (ALLOWED_TEXT.has(text.trim())) return
    hits.push({ file: rel, line: lineOf(src, index), text: text.trim().replace(/\s+/g, ' ') })
  }

  // (a) attributi con testo scritto a mano: aria-label="...", label={'...'}
  const attr = new RegExp(`(?<![\\w-])(${ATTRS.join('|')})=(?:"([^"]*)"|'([^']*)'|\\{\\s*(?:'([^']*)'|"([^"]*)"|\`([^\`$]*)\`)\\s*\\})`, 'g')
  for (const m of src.matchAll(attr)) {
    const value = m[2] ?? m[3] ?? m[4] ?? m[5] ?? m[6] ?? ''
    if (LETTER.test(value)) add(m.index!, `${m[1]}="${value}"`)
  }

  // (b) toast(...) con testo scritto a mano
  for (const m of src.matchAll(/\b(?:toast|setError|setNotice)\(\s*(['"`])([^'"`$]*)\1/g)) {
    if (LETTER.test(m[2]!)) add(m.index!, `${m[0]}`)
  }

  // (c) testo del JSX: tra '>' o '}' e '<' o '{', senza segni di codice
  const masked = maskStrings(src)
  for (const m of masked.matchAll(/[>}]([^<>{}]+)(?=[<{])/g)) {
    const run = m[1]!
    if (!LETTER.test(run)) continue
    if (/[=;()[\]&|?`'"\\]|=>|\/\/|^\s*\/>/.test(run) || CODE_WORD.test(run)) continue // codice, non testo
    add(m.index! + 1, run)
  }
  return hits
}

describe('niente testo scritto a mano nei componenti', () => {
  it('trova i file da controllare', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('il rilevatore riconosce un testo scritto a mano', () => {
    const sample = `export const X = () => (<button aria-label="Chiudi" title={'Apri'}>Salva</button>)`
    const attr = [...sample.matchAll(/(?<![\w-])(aria-label)="([^"]*)"/g)]
    expect(attr).toHaveLength(1)
    expect([...maskStrings(sample).matchAll(/[>}]([^<>{}]+)(?=[<{])/g)].some((m) => LETTER.test(m[1]!))).toBe(true)
  })

  it('JSX e attributi leggono tutto dal dizionario', () => {
    const hits = files.flatMap(scan)
    const report = hits.map((h) => `${h.file}:${h.line}  ${h.text}`)
    expect(report).toEqual([])
  })
})
