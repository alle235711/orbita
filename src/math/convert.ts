// Convertitore assistito: propone la versione LaTeX del testo di una scheda
// scritta in ASCII ("E_n = -Z^2 13,6 eV / n^2", "4 pi eps_0 (h tagliato)^2").
// Funzione pura e deterministica: restituisce una proposta, non applica nulla.
//
// Il testo si divide in parole. Ogni parola riceve un tipo:
// - forte: ha un pedice o un apice (E_n, Z^2), è un simbolo del dizionario
//   (lambda, h tagliato, ->) o è già un comando LaTeX;
// - debole: numeri, lettere singole, espressioni con operatori (1/r, P(r)),
//   differenziali (dr, dt), unità di misura;
// - operatore: = + - / * < > |;
// - testo: tutto il resto, comprese le parole con l'apostrofo o gli accenti.
// Le parole ambigue (greche che sono anche parole italiane, "e"/"a" in mezzo
// a una formula, "somma diretta" e simili) si decidono guardando le vicine.
// Una sequenza di parole non di testo diventa una formula `$...$` solo se
// contiene almeno una parola forte: "J = 1" resta com'è, "F = 1 -> F = 0" no.

import { splitMath } from './delimiters'
import { ASCII_OPERATORS, FUNCTIONS, GREEK, OPERATOR_NAMES, PHRASES, UNITS, type Phrase } from './dictionary'

type Kind = 'prose' | 'strong' | 'weak' | 'op' | 'binop' | 'ambig' | 'vowel'

interface Token {
  /** Testo originale (per le espressioni di più parole, tutte le parole con i loro spazi). */
  raw: string
  /** La parola senza la punteggiatura finale; per le espressioni, già il comando LaTeX. */
  core: string
  /** Punteggiatura finale (virgola, punto, due punti...). */
  trail: string
  /** Spazio che precede la parola nel testo originale. */
  sep: string
  kind: Kind
  phrase?: Phrase['kind']
}

const PHRASES_BY_LENGTH = [...PHRASES].sort((a, b) => b.words.length - a.words.length)
const OPERATOR_KEYS = Object.keys(ASCII_OPERATORS).sort((a, b) => b.length - a.length)
const SINGLE_OPS = new Set(['=', '+', '-', '/', '*', '<', '>', '|', '~'])
const VOWELS = new Set(['a', 'e', 'i', 'o'])
const UNIT_SET = new Set(UNITS)
const OPNAME_SET = new Set(OPERATOR_NAMES)

const LETTER = /[A-Za-z]/
const ELISION_OR_ACCENT = /[A-Za-zÀ-ÿ]['’][A-Za-zÀ-ÿ]|[À-ÿ’«»"“”]/
const NUMBER = /^[+-]?\d+(?:[.,]\d+)*$/
const NUMERIC_EXPR = /^[\d+\-*/=<>().,|]+$/

/** Separa la punteggiatura finale, lasciando i puntini di sospensione alla parola. */
function splitTrail(word: string): [string, string] {
  let end = word.length
  while (end > 0) {
    const ch = word[end - 1]!
    if (',;:!?'.includes(ch)) end--
    else if (ch === '.' && word[end - 2] !== '.' && end > 1) end--
    else break
  }
  return [word.slice(0, end), word.slice(end)]
}

/** La parola senza le parentesi che la avvolgono: "(m_e" → "m_e", "-(e" → "e", "c)" → "c". */
const unwrap = (core: string) => core.replace(/^[+-]?\(+/, '').replace(/\)+$/, '')

function baseKind(core: string): Kind {
  if (!core) return 'prose'
  if (core in ASCII_OPERATORS) return core === '...' ? 'weak' : 'strong'
  if (ELISION_OR_ACCENT.test(core)) return 'prose'
  if (/\\[A-Za-z]+/.test(core)) return 'strong'
  if (/[_^]/.test(core)) return 'strong'
  if (SINGLE_OPS.has(core)) return 'op'
  const inner = unwrap(core)
  if (!inner) return 'weak'
  const greek = GREEK[inner]
  if (greek) return greek.ambiguous ? 'ambig' : 'strong'
  if (NUMBER.test(inner) || (NUMERIC_EXPR.test(inner) && /\d/.test(inner))) return 'weak'
  if (UNIT_SET.has(inner)) return 'weak'
  if (/^[A-Za-z]$/.test(inner)) return VOWELS.has(inner) ? 'vowel' : 'weak'
  if (/^[+-][A-Za-z]$/.test(inner)) return 'weak'
  if (/^[A-Za-z]'+$/.test(inner)) return 'weak'
  if (/^[A-Za-z]\d+$/.test(inner) || /^\d+[A-Za-z]$/.test(inner)) return 'weak' // x0, 2Z, 2n
  if (/^[a-z][A-Z]$/.test(inner)) return 'weak' // kT: mai una parola italiana
  if (FUNCTIONS[inner] || OPNAME_SET.has(inner)) return 'weak'
  if (/^d[b-df-hj-np-tv-zA-Z]'?$/.test(inner)) return 'weak' // dr, dt, dV: mai "di", "da"
  if (/^[A-Za-z](?:\.[A-Za-z])+$/.test(inner)) return 'weak' // prodotti scalari: e.r, L.S
  if (/[=<>|+*/]/.test(inner) || /[A-Za-z0-9]\(/.test(inner)) return 'weak'
  return 'prose'
}

function tokenize(source: string): Token[] {
  const parts = source.split(/(\s+)/)
  const tokens: Token[] = []
  let sep = ''
  for (const part of parts) {
    if (!part) continue
    if (/^\s+$/.test(part)) {
      sep = part
      continue
    }
    const [core, trail] = splitTrail(part)
    tokens.push({ raw: part, core, trail, sep, kind: baseKind(core) })
    sep = ''
  }
  return tokens
}

/** Prova l'espressione `phrase` a partire da tokens[i]; restituisce il token fuso o null. */
function matchPhrase(tokens: Token[], i: number, phrase: Phrase): Token | null {
  const n = phrase.words.length
  if (i + n > tokens.length) return null
  for (let k = 0; k < n - 1; k++) if (tokens[i + k]!.trail) return null
  const first = tokens[i]!.core
  const lead = phrase.kind === 'symbol' && first.startsWith('(')
  const firstWord = lead ? first.slice(1) : first
  const lastCore = n === 1 ? firstWord : tokens[i + n - 1]!.core
  const lastWord = phrase.words[n - 1]!
  if (n > 1 && firstWord !== phrase.words[0]) return null
  for (let k = 1; k < n - 1; k++) if (tokens[i + k]!.core !== phrase.words[k]) return null
  if (!lastCore.startsWith(lastWord)) return null
  const rest = lastCore.slice(lastWord.length)
  if (phrase.kind !== 'symbol' ? rest !== '' : /^[A-Za-zÀ-ÿ0-9]/.test(rest)) return null
  let core = phrase.tex
  if (phrase.kind === 'symbol') {
    const close = rest.startsWith(')')
    core = lead && close ? phrase.tex + rest.slice(1) : (lead ? '(' : '') + phrase.tex + rest
  }
  const span = tokens.slice(i, i + n)
  return {
    raw: span.map((t, k) => (k ? t.sep : '') + t.raw).join(''),
    core,
    trail: span[n - 1]!.trail,
    sep: span[0]!.sep,
    kind: phrase.kind === 'symbol' ? 'strong' : n === 1 ? baseKind(first) : 'prose',
    phrase: phrase.kind,
  }
}

function mergePhrases(tokens: Token[]): Token[] {
  const out: Token[] = []
  for (let i = 0; i < tokens.length; ) {
    let merged: Token | null = null
    for (const phrase of PHRASES_BY_LENGTH) {
      merged = matchPhrase(tokens, i, phrase)
      if (merged) {
        i += phrase.words.length
        break
      }
    }
    if (merged) out.push(merged)
    else out.push(tokens[i++]!)
  }
  return out
}

const isOperand = (t: Token | undefined) => !!t && (t.kind === 'strong' || t.kind === 'weak' || t.kind === 'ambig')
const isMathy = (t: Token | undefined) => !!t && (t.kind === 'strong' || t.kind === 'weak' || t.kind === 'op' || t.kind === 'binop')
const isOperator = (t: Token | undefined) => !!t && (t.kind === 'op' || t.kind === 'binop')

/** Le vicine: a sinistra solo se non c'è punteggiatura in mezzo, a destra solo se la parola non ne ha. */
function neighbours(tokens: Token[], i: number): [Token | undefined, Token | undefined] {
  const t = tokens[i]!
  const left = tokens[i - 1]
  const right = tokens[i + 1]
  return [left && !left.trail && !/\n/.test(t.sep) ? left : undefined, right && !t.trail && !/\n/.test(right.sep) ? right : undefined]
}

function resolve(tokens: Token[]): void {
  tokens.forEach((t, i) => {
    if (t.phrase !== 'binary') return
    const [l, r] = neighbours(tokens, i)
    if (isOperand(l) && isOperand(r)) t.kind = 'binop'
    else if (t.raw.includes(' ')) t.kind = 'prose'
    else t.core = t.raw.slice(0, t.raw.length - t.trail.length)
  })
  tokens.forEach((t, i) => {
    if (t.kind !== 'ambig') return
    const [l, r] = neighbours(tokens, i)
    t.kind = isMathy(l) || isMathy(r) ? 'strong' : 'prose'
  })
  tokens.forEach((t, i) => {
    if (t.kind !== 'vowel') return
    const [l, r] = neighbours(tokens, i)
    t.kind = isOperator(l) || isOperator(r) ? 'weak' : 'prose'
  })
}

/** Il comando seguito da uno spazio se dopo viene una lettera (\pi a, non \pia). */
const command = (tex: string, next: string | undefined) => (next && LETTER.test(next) && /[A-Za-z]$/.test(tex) ? `${tex} ` : tex)

function wordTex(word: string): string {
  const greek = GREEK[word]
  if (greek) return greek.tex
  const fn = FUNCTIONS[word]
  if (fn) return fn
  if (OPNAME_SET.has(word)) return `\\operatorname{${word}}`
  return word
}

/** L'argomento di un pedice o di un apice che inizia in `j`: [LaTeX, caratteri consumati]. */
function scriptArg(src: string, j: number): [string, number] {
  const rest = src.slice(j)
  if (rest.startsWith('(')) {
    let depth = 0
    for (let k = 0; k < rest.length; k++) {
      if (rest[k] === '(') depth++
      else if (rest[k] === ')' && --depth === 0) return [`{${texWord(rest.slice(1, k))}}`, k + 1]
    }
    return ['', 0]
  }
  const frac = /^[+-]?\d+\/\d+/.exec(rest)
  if (frac) return [`{${frac[0]}}`, frac[0].length]
  const num = /^[+-]?\d+/.exec(rest)
  if (num) return [num[0].length === 1 ? num[0] : `{${num[0]}}`, num[0].length]
  const word = /^[A-Za-z]+/.exec(rest)
  if (word) {
    const w = word[0]
    if (GREEK[w]) return [`{${GREEK[w].tex}}`, w.length]
    return [w.length === 1 ? w : `{${w}}`, w.length]
  }
  if (rest.startsWith('*')) return ['*', 1]
  if (rest.startsWith('\\')) {
    const cmd = /^\\[A-Za-z]+/.exec(rest)
    if (cmd) return [`{${cmd[0]}}`, cmd[0].length]
  }
  return ['', 0]
}

/** Una parola dentro una formula, in LaTeX. */
function texWord(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const op = OPERATOR_KEYS.find((k) => src.startsWith(k, i))
    if (op) {
      out += command(ASCII_OPERATORS[op]!, src[i + op.length])
      i += op.length
      continue
    }
    const ch = src[i]!
    if (ch === '\\') {
      const cmd = /^\\[A-Za-z]+/.exec(src.slice(i))
      if (cmd) {
        out += command(cmd[0], src[i + cmd[0].length])
        i += cmd[0].length
        continue
      }
      out += ch
      i++
      continue
    }
    if (ch === '_' || ch === '^') {
      const [arg, used] = scriptArg(src, i + 1)
      out += ch + arg
      i += 1 + used
      continue
    }
    if (LETTER.test(ch)) {
      const word = /^[A-Za-z]+/.exec(src.slice(i))![0]
      out += command(wordTex(word), src[i + word.length])
      i += word.length
      continue
    }
    const decimal = /^\d+(?:,\d+)+/.exec(src.slice(i))
    if (decimal) {
      out += decimal[0].replace(/,/g, '{,}')
      i += decimal[0].length
      continue
    }
    if ('%&#$'.includes(ch)) out += `\\${ch}`
    else out += ch
    i++
  }
  return out
}

/** `^(` e `_(` rimasti aperti dentro una parola (`rho^(1 + 1/n)`) si chiudono sull'intera formula. */
function groupScripts(tex: string): string {
  let out = tex
  for (let from = out.search(/[_^]\(/); from >= 0; ) {
    const open = from + 1
    let depth = 0
    let close = -1
    for (let k = open; k < out.length; k++) {
      if (out[k] === '(') depth++
      else if (out[k] === ')' && --depth === 0) {
        close = k
        break
      }
    }
    if (close < 0) break
    out = `${out.slice(0, open)}{${out.slice(open + 1, close)}}${out.slice(close + 1)}`
    const next = out.slice(open).search(/[_^]\(/)
    from = next < 0 ? -1 : open + next
  }
  return out
}

/** `\sqrt(...)` con le parentesi bilanciate diventa `\sqrt{...}`. */
function fixSqrt(tex: string): string {
  let out = tex
  for (let from = out.indexOf('\\sqrt('); from >= 0; from = out.indexOf('\\sqrt(', from + 1)) {
    const open = from + 5
    let depth = 0
    for (let k = open; k < out.length; k++) {
      if (out[k] === '(') depth++
      else if (out[k] === ')' && --depth === 0) {
        out = `${out.slice(0, open)}{${out.slice(open + 1, k)}}${out.slice(k + 1)}`
        break
      }
    }
  }
  return out
}

const depthOf = (s: string) => [...s].reduce((d, ch) => d + (ch === '(' ? 1 : ch === ')' ? -1 : 0), 0)
const escapeProse = (s: string) => s.replace(/(^|[^\\])\$/g, (_m, before: string) => `${before}\\$`)

/** Le parole di una formula in LaTeX, senza delimitatori. */
function runTex(run: Token[]): string {
  let tex = ''
  run.forEach((t, k) => {
    const isLast = k === run.length - 1
    const unit = UNIT_SET.has(unwrap(t.core))
    const body = t.kind === 'binop' ? t.core : unit ? `\\mathrm{${t.core}}` : texWord(t.core)
    const prev = run[k - 1]
    const join = !prev ? '' : unit && NUMBER.test(unwrap(prev.core)) ? '\\,' : ' '
    tex += join + body + (isLast ? '' : t.trail)
  })
  return fixSqrt(groupScripts(tex))
}

/** Vero se la parentesi in `at` non ha la sua compagna dentro `tex`. */
function unmatched(tex: string, at: number): boolean {
  const step = tex[at] === '(' ? 1 : -1
  let depth = 0
  for (let k = at; k >= 0 && k < tex.length; k += step) {
    if (tex[k] === '(') depth += step
    else if (tex[k] === ')') depth -= step
    if (depth === 0) return false
  }
  return true
}

/** Una sequenza di parole come formula: `$...$` più la punteggiatura e le parentesi spaiate che restano fuori. */
function mathRun(run: Token[]): string {
  let tex = runTex(run)
  let before = ''
  let after = ''
  while (tex.startsWith('(') && unmatched(tex, 0)) {
    tex = tex.slice(1)
    before += '('
  }
  while (tex.endsWith(')') && unmatched(tex, tex.length - 1)) {
    tex = tex.slice(0, -1)
    after = `)${after}`
  }
  return `${before}$${tex}$${after}${run[run.length - 1]!.trail}`
}

/** Raggruppa le parole: ogni parola di testo da sola, le altre in sequenze candidate a formula. */
function runs(tokens: Token[]): Token[][] {
  const groups: Token[][] = []
  let current: Token[] = []
  let depth = 0
  const close = () => {
    if (current.length) groups.push(current)
    current = []
    depth = 0
  }
  for (const t of tokens) {
    if (t.kind === 'prose') {
      close()
      groups.push([t])
      continue
    }
    if (current.length && /\n/.test(t.sep)) close()
    current.push(t)
    depth += depthOf(t.core)
    // La punteggiatura chiude la formula, tranne dentro una parentesi aperta: "(r, theta, phi)".
    if (t.trail && depth <= 0) close()
  }
  close()
  return groups
}

const emitProse = (tokens: Token[]) => tokens.map((t) => t.sep + escapeProse(t.raw)).join('')

/** La proposta LaTeX per un testo in ASCII. Un testo che ha già delle formule torna com'è. */
export function convertText(source: string): string {
  if (splitMath(source).some((s) => s.type !== 'text')) return source
  const tokens = mergePhrases(tokenize(source))
  resolve(tokens)
  let out = ''
  for (const group of runs(tokens)) {
    if (group[0]!.kind === 'prose') {
      out += emitProse(group)
      continue
    }
    // Gli operatori ai bordi restano fuori dalla formula.
    let s = 0
    let e = group.length
    while (s < e && isOperator(group[s])) s++
    while (e > s && isOperator(group[e - 1])) e--
    const core = group.slice(s, e)
    if (!core.some((t) => t.kind === 'strong' || t.kind === 'binop')) {
      out += emitProse(group)
      continue
    }
    out += emitProse(group.slice(0, s)) + core[0]!.sep + mathRun(core) + emitProse(group.slice(e))
  }
  return out + /\s*$/.exec(source)![0]
}

/** Un pezzo di testo trattato tutto come formula (per ritrovare la chiave dentro la proposta). */
export function fragmentTex(fragment: string): string {
  const tokens = mergePhrases(tokenize(fragment))
  for (const t of tokens) if (t.phrase === 'binary') t.kind = 'binop'
  return runTex(tokens)
}

export interface CardConversion {
  /** Il testo proposto. */
  text: string
  /** La chiave da usare dopo la conversione. */
  key: string
  /** La proposta è diversa dal testo attuale. */
  changed: boolean
  /** Il testo ha già delle formule: non si propone nulla. */
  alreadyLatex: boolean
  /** La chiave non si ritrova nella proposta: va ricontrollata a mano. */
  keyLost: boolean
}

/** La chiave da usare con un testo convertito: com'è, oppure nella sua forma LaTeX, oppure persa. */
export function relocateKey(text: string, key: string): { key: string; lost: boolean } {
  if (!key || text.includes(key)) return { key, lost: false }
  const converted = fragmentTex(key)
  if (converted && text.includes(converted)) return { key: converted, lost: false }
  return { key, lost: true }
}

/** La proposta per una scheda: testo e chiave, che deve restare una parte del testo per la modalità Completa. */
export function convertCard(card: { text: string; key: string }): CardConversion {
  const alreadyLatex = splitMath(card.text).some((s) => s.type !== 'text')
  const text = convertText(card.text)
  const { key, lost } = relocateKey(text, card.key)
  return { text, key, changed: text !== card.text, alreadyLatex, keyLost: lost }
}
