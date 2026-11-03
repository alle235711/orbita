// Letture elementari del sorgente .tex: commenti, gruppi tra graffe, righe.
// Funzioni pure, che non lanciano mai eccezioni.

/**
 * Toglie i commenti: da un `%` non preceduto da `\` fino alla fine della riga
 * (l'a capo resta, così i numeri di riga non cambiano). `\%` è un percento
 * vero; `\\%` è un a capo di TeX seguito da un commento.
 */
export function stripComments(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (ch === '\\') {
      out += ch + (src[i + 1] ?? '')
      i += 2
    } else if (ch === '%') {
      while (i < src.length && src[i] !== '\n' && src[i] !== '\r') i++
    } else {
      out += ch
      i++
    }
  }
  return out
}

/** Le graffe sono bilanciate? `\{` e `\}` non contano. Mai una graffa chiusa prima di averla aperta. */
export function bracesBalanced(src: string): boolean {
  let depth = 0
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!
    if (ch === '\\') i++
    else if (ch === '{') depth++
    else if (ch === '}' && --depth < 0) return false
  }
  return depth === 0
}

const isSpace = (ch: string | undefined) => ch !== undefined && /\s/.test(ch)

export function skipSpaces(src: string, from: number): number {
  let i = from
  while (i < src.length && isSpace(src[i])) i++
  return i
}

export interface Group {
  /** Il contenuto, senza le parentesi esterne. */
  value: string
  /** Posizione subito dopo la parentesi che chiude. */
  next: number
}

/**
 * Legge un gruppo che comincia in `from` (con `{` o `[`) fino alla parentesi che chiude.
 * Dentro `[...]` le graffe contano, così `[Teorema di {Bolzano[1]}]` è un solo titolo.
 * Null se il gruppo non si chiude (o in `from` non c'è la parentesi).
 */
export function readGroup(src: string, from: number, open: '{' | '['): Group | null {
  if (src[from] !== open) return null
  const close = open === '{' ? '}' : ']'
  let braces = 0
  for (let i = from + 1; i < src.length; i++) {
    const ch = src[i]!
    if (ch === '\\') {
      i++
    } else if (ch === '{') {
      braces++
    } else if (ch === '}') {
      if (braces === 0) return open === '{' ? { value: src.slice(from + 1, i), next: i + 1 } : null
      braces--
    } else if (ch === close && open === '[' && braces === 0) {
      return { value: src.slice(from + 1, i), next: i + 1 }
    }
  }
  return null
}

/** Numeri di riga (da 1) di ogni posizione del sorgente. */
export function lineIndex(src: string): (pos: number) => number {
  const starts = [0]
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') starts.push(i + 1)
  return (pos) => {
    let lo = 0
    let hi = starts.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (starts[mid]! <= pos) lo = mid
      else hi = mid - 1
    }
    return lo + 1
  }
}

/** Quanti `\` di fila precedono la posizione: se sono dispari, il carattere in `pos` è escapato. */
export function escapedAt(src: string, pos: number): boolean {
  let n = 0
  for (let i = pos - 1; i >= 0 && src[i] === '\\'; i--) n++
  return n % 2 === 1
}
