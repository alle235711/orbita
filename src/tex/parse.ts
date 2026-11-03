// Schede da un file .tex (SPEC fase 3, fetta I). Funzioni pure, nessun I/O.
//
// Si leggono solo gli ambienti di teoremi: `\begin{amb}[titolo] ... \end{amb}`
// per gli ambienti noti (quelli di `\newtheorem`, l'elenco di serie e quello
// scritto a mano). Gli errori sono per blocco: un blocco rotto dà un errore
// con la riga e gli altri si importano lo stesso.
//
// Fuori scopo: macro `\newcommand` personalizzate, `\input` ricorsivi e
// bibliografia. Il campo "chiave" delle schede non si ricava, resta vuoto.

import type { ErrorCode } from '../i18n/errors'
import { bodyToText, cleanTitle } from './body'
import { bracesBalanced, escapedAt, lineIndex, readGroup, skipSpaces, stripComments } from './scan'

/** Gli ambienti che si importano se il file non dice altro: italiani e inglesi. */
export const DEFAULT_ENVIRONMENTS: readonly string[] = [
  'definizione',
  'teorema',
  'lemma',
  'proposizione',
  'corollario',
  'osservazione',
  'esempio',
  'definition',
  'theorem',
  'proposition',
  'corollary',
  'remark',
  'example',
]

/** Ambienti di LaTeX che non sono schede: si saltano senza segnalarli. */
const KNOWN_OTHER = new Set([
  'document', 'abstract', 'proof', 'dimostrazione', 'itemize', 'enumerate', 'description', 'equation', 'displaymath', 'align', 'aligned',
  'alignat', 'gather', 'gathered', 'multline', 'split', 'eqnarray', 'subequations', 'cases', 'array', 'matrix', 'pmatrix', 'bmatrix',
  'vmatrix', 'Vmatrix', 'smallmatrix', 'figure', 'table', 'tabular', 'center', 'flushleft', 'flushright', 'quote', 'quotation', 'verse',
  'verbatim', 'minipage', 'tikzpicture', 'thebibliography', 'frame', 'lstlisting', 'titlepage', 'tabbing', 'wrapfigure', 'sidewaystable',
  'sidewaysfigure', 'small', 'footnotesize', 'tiny', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'raggedright', 'raggedleft', 'sloppypar',
  'longtable', 'tabularx', 'multicols', 'appendix', 'theindex', 'filecontents', 'comment',
])

export type TexErrorCode = Extract<ErrorCode, `tex${string}`>

/** Un problema di un blocco, con la riga (da 1) del file. Si mostra con `new AppError(code, params)`. */
export interface TexError {
  code: TexErrorCode
  params: Record<string, string | number>
  line: number
  fileName: string
}

export interface TexCard {
  fileName: string
  /** Il nome dell'ambiente come scritto nel file (`thm`, `teorema`). */
  env: string
  /** Quanto l'ambiente occorre prima di questo, nel file, più uno: il progressivo che dà l'id. */
  number: number
  /** Il tipo della scheda: il nome dell'ambiente in minuscolo ("teorema"). */
  kind: string
  title: string
  /** Il titolo veniva dall'argomento opzionale `[...]`. */
  titleGiven: boolean
  section: string
  text: string
  /** Riga del `\begin`. */
  line: number
}

export interface TexFileResult {
  fileName: string
  cards: TexCard[]
  errors: TexError[]
}

export interface TexSource {
  name: string
  text: string
}

export interface ParseOptions {
  /** Altri ambienti da importare, oltre a quelli di serie e ai `\newtheorem`. */
  environments?: readonly string[]
  /** Ambienti definiti con `\newtheorem` (nome → titolo), di tutti i file scelti. */
  theorems?: ReadonlyMap<string, string>
}

const baseName = (fileName: string) => fileName.replace(/\.[^./\\]+$/, '')

/** Un nome scritto a mano: senza `\begin{}`, spazi e asterisco finale. */
export function normalizeEnvName(raw: string): string {
  return raw.trim().replace(/^\\?begin\s*\{|\}$/g, '').trim()
}

/** Un elenco di ambienti scritto a mano ("esercizio, notazione") in nomi, senza doppioni. */
export function parseEnvList(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map(normalizeEnvName).filter(Boolean))]
}

// ---------------------------------------------------------------------------
// \newtheorem

interface TheoremScan {
  theorems: Map<string, string>
  errors: { line: number }[]
}

function scanTheorems(src: string, lineOf: (pos: number) => number): TheoremScan {
  const theorems = new Map<string, string>()
  const errors: { line: number }[] = []
  const re = /\\newtheorem(\*?)(?![A-Za-z])/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (escapedAt(src, m.index)) continue
    // {nome}, poi [contatore] oppure niente, poi {Titolo}, poi [dentro] oppure niente
    let p = skipSpaces(src, m.index + m[0].length)
    const name = readGroup(src, p, '{')
    if (!name) {
      errors.push({ line: lineOf(m.index) })
      continue
    }
    p = skipSpaces(src, name.next)
    const counter = readGroup(src, p, '[')
    if (counter) p = skipSpaces(src, counter.next)
    const title = readGroup(src, p, '{')
    const key = name.value.trim()
    const display = title ? cleanTitle(title.value) : ''
    if (!key || !display) {
      errors.push({ line: lineOf(m.index) })
      continue
    }
    theorems.set(key, display)
    re.lastIndex = title!.next
  }
  return { theorems, errors }
}

/** Gli ambienti di `\newtheorem` di tutti i file scelti: in un progetto con più file sono nel preambolo, non in ogni capitolo. */
export function collectTheorems(sources: readonly TexSource[]): Map<string, string> {
  const out = new Map<string, string>()
  for (const s of sources) {
    const src = stripComments(s.text)
    for (const [k, v] of scanTheorems(src, lineIndex(src)).theorems) out.set(k, v)
  }
  return out
}

// ---------------------------------------------------------------------------
// sezioni

interface Heading {
  index: number
  title: string
}

function scanHeadings(src: string, lineOf: (pos: number) => number, fail: (line: number) => void): Heading[] {
  const out: Heading[] = []
  const re = /\\(?:subsection|section)\*?(?![A-Za-z])/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (escapedAt(src, m.index)) continue
    let p = skipSpaces(src, m.index + m[0].length)
    const short = readGroup(src, p, '[')
    if (short) p = skipSpaces(src, short.next)
    const title = readGroup(src, p, '{')
    const text = title ? cleanTitle(title.value) : ''
    if (!title || !text) {
      fail(lineOf(m.index))
      continue
    }
    out.push({ index: m.index, title: text })
    re.lastIndex = title.next
  }
  return out
}

// ---------------------------------------------------------------------------
// ambienti

interface EnvNode {
  env: string
  /** Posizione del `\begin`. */
  begin: number
  /** Subito dopo `\begin{amb}`. */
  inner: number
  /** Posizione del `\end` che lo chiude, se c'è. */
  close: number
  /** `closed` = chiuso dal suo `\end`; `broken` = senza `\end`, o chiuso da uno che non corrisponde. */
  status: 'closed' | 'broken'
  /** Quante volte l'ambiente è già comparso nel file, più uno. */
  number: number
  children: EnvNode[]
  /** Dentro c'è un blocco rotto. */
  hasBroken: boolean
}

const capitalize = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

export function parseTex(source: string, fileName: string, options: ParseOptions = {}): TexFileResult {
  const cards: TexCard[] = []
  const errors: TexError[] = []
  try {
    parseInto(source, fileName, options, cards, errors)
  } catch {
    // Non deve succedere: se succede, il file non fa cadere l'importazione.
    errors.push({ code: 'texInternal', params: {}, line: 1, fileName })
  }
  // Gli errori nell'ordine del file, non in quello in cui si sono scoperti.
  errors.sort((a, b) => a.line - b.line)
  return { fileName, cards, errors }
}

function parseInto(source: string, fileName: string, options: ParseOptions, cards: TexCard[], errors: TexError[]): void {
  const src = stripComments(source)
  const lineOf = lineIndex(src)
  const fail = (code: TexErrorCode, line: number, params: Record<string, string | number> = {}) =>
    errors.push({ code, params: { ...params, line }, line, fileName })

  // 1. quali ambienti sono schede, e come si chiamano
  const own = scanTheorems(src, lineOf)
  for (const e of own.errors) fail('texBadNewtheorem', e.line)
  const names = new Map<string, string>()
  for (const env of DEFAULT_ENVIRONMENTS) names.set(env, capitalize(env))
  for (const env of options.environments ?? []) if (env) names.set(env, capitalize(env))
  for (const [env, title] of options.theorems ?? []) names.set(env, title)
  for (const [env, title] of own.theorems) names.set(env, title)

  // 2. gli `\begin` e `\end`, in un albero
  const root: EnvNode = { env: '', begin: 0, inner: 0, close: src.length, status: 'closed', number: 0, children: [], hasBroken: false }
  const stack: EnvNode[] = [root]
  const seen = new Map<string, number>()
  const markBroken = (n: EnvNode) => {
    n.status = 'broken'
    for (const a of stack) a.hasBroken = true
  }
  const re = /\\(begin|end)\s*\{([^{}]*)\}/g
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (escapedAt(src, m.index)) continue
    const env = m[2]!.trim()
    if (m[1] === 'begin') {
      const number = (seen.get(env) ?? 0) + 1
      seen.set(env, number)
      const node: EnvNode = { env, begin: m.index, inner: m.index + m[0].length, close: src.length, status: 'closed', number, children: [], hasBroken: false }
      stack[stack.length - 1]!.children.push(node)
      stack.push(node)
      continue
    }
    const line = lineOf(m.index)
    let depth = stack.length - 1
    while (depth > 0 && stack[depth]!.env !== env) depth--
    if (depth > 0) {
      // I `\begin` rimasti sopra non sono mai stati chiusi.
      for (let k = stack.length - 1; k > depth; k--) {
        const open = stack[k]!
        fail('texUnclosedEnv', lineOf(open.begin), { env: open.env })
        markBroken(open)
        stack.pop()
      }
      const done = stack.pop()!
      done.close = m.index
      // chiuso bene lui, ma dentro c'è qualcosa di rotto
    } else if (stack.length > 1) {
      const open = stack[stack.length - 1]!
      fail('texMismatch', line, { end: env, begin: open.env, beginLine: lineOf(open.begin) })
      markBroken(open)
      stack.pop()
    } else {
      fail('texStrayEnd', line, { env })
    }
  }
  for (let k = stack.length - 1; k > 0; k--) {
    const open = stack[k]!
    fail('texUnclosedEnv', lineOf(open.begin), { env: open.env })
    markBroken(open)
  }

  // 3. sezioni
  const headings = scanHeadings(src, lineOf, (line) => fail('texBadHeading', line))
  const sectionAt = (pos: number): string => {
    let found = baseName(fileName)
    for (const h of headings) {
      if (h.index >= pos) break
      found = h.title
    }
    return found
  }

  // 4. le schede
  const visit = (node: EnvNode) => {
    for (const child of node.children) {
      const display = names.get(child.env)
      if (display === undefined) {
        if (child.status === 'closed' && !KNOWN_OTHER.has(child.env.replace(/\*$/, ''))) fail('texUnknownEnv', lineOf(child.begin), { env: child.env })
        visit(child)
      } else if (child.status === 'closed' && !child.hasBroken) {
        const card = cardOf(child, display)
        if (card) cards.push(card)
      } else {
        // rotto: già segnalato; le schede chiuse bene al suo interno si importano
        visit(child)
      }
    }
  }

  const cardOf = (node: EnvNode, display: string): TexCard | null => {
    const line = lineOf(node.begin)
    let start = node.inner
    let title = ''
    const open = skipSpaces(src, start)
    if (src[open] === '[') {
      const arg = readGroup(src.slice(0, node.close), open, '[')
      if (!arg) {
        fail('texBadTitle', line, { env: node.env })
        return null
      }
      title = cleanTitle(arg.value)
      start = arg.next
    }
    const raw = src.slice(start, node.close)
    if (!bracesBalanced(raw) || !bracesBalanced(title)) {
      fail('texBraces', line, { env: node.env })
      return null
    }
    const text = bodyToText(raw)
    if (!text) {
      fail('texEmpty', line, { env: node.env })
      return null
    }
    return {
      fileName,
      env: node.env,
      number: node.number,
      kind: display.toLowerCase(),
      title: title || `${display} ${node.number}`,
      titleGiven: !!title,
      section: sectionAt(node.begin),
      text,
      line,
    }
  }

  visit(root)
}

/** Tutti i file scelti: i `\newtheorem` valgono per ognuno, i risultati restano nell'ordine dei file. */
export function parseTexFiles(files: readonly TexSource[], extraEnvironments: readonly string[] = []): TexFileResult[] {
  const theorems = collectTheorems(files)
  return files.map((f) => parseTex(f.text, f.name, { environments: extraEnvironments, theorems }))
}
