// Divide il testo di una scheda in pezzi di testo e formule. Funzione pura,
// che non lancia mai eccezioni: quello che non è una formula ben chiusa resta
// testo così com'è.
//
// - `$$...$$` è una formula in display e ha la precedenza su `$`.
// - `$...$` è una formula in linea. Come in Pandoc, il `$` che apre deve
//   essere seguito da un carattere che non sia uno spazio, quello che chiude
//   deve seguire un carattere che non sia uno spazio e non essere seguito da
//   una cifra: così "costa 5$ e 10$" resta testo.
// - `\$` è un dollaro letterale: nel testo diventa `$`, dentro una formula
//   resta `\$` (il dollaro di TeX).
// - Una formula non chiusa o vuota resta testo, delimitatori compresi.

export type MathSegment =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'display'; value: string }

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch)
const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9'

/** Il primo `$$` non preceduto da `\` a partire da `from`, oppure -1. */
function findDisplayEnd(src: string, from: number): number {
  for (let i = from; i < src.length - 1; i++) {
    if (src[i] === '\\') {
      i++
      continue
    }
    if (src[i] === '$' && src[i + 1] === '$') return i
  }
  return -1
}

/** Il `$` che chiude una formula in linea aperta in `from - 1`, oppure -1. */
function findInlineEnd(src: string, from: number): number {
  for (let i = from; i < src.length; i++) {
    if (src[i] === '\\') {
      i++
      continue
    }
    if (src[i] !== '$') continue
    if (!isSpace(src[i - 1]) && !isDigit(src[i + 1])) return i
    // Un `$` che non può chiudere (spazio prima o cifra dopo) interrompe la formula.
    return -1
  }
  return -1
}

/** Un pezzo con la sua posizione nel sorgente: `start`..`end` coprono anche i delimitatori, `bodyStart`..`bodyEnd` solo il corpo. */
export type MathSpan = MathSegment & { start: number; end: number; bodyStart: number; bodyEnd: number }

/** Come `splitMath`, ma ogni pezzo porta le sue posizioni nel sorgente (serve a nascondere una formula senza toccare il resto). */
export function scanMath(source: string): MathSpan[] {
  const out: MathSpan[] = []
  let text = ''
  let textStart = 0
  const pushText = (s: string, at: number) => {
    if (!text) textStart = at
    text += s
  }
  const flush = (at: number) => {
    if (text) out.push({ type: 'text', value: text, start: textStart, end: at, bodyStart: textStart, bodyEnd: at })
    text = ''
  }

  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    if (ch === '\\' && source[i + 1] === '$') {
      pushText('$', i)
      i += 2
      continue
    }
    if (ch !== '$') {
      pushText(ch, i)
      i++
      continue
    }
    if (source[i + 1] === '$') {
      const end = findDisplayEnd(source, i + 2)
      const body = end < 0 ? '' : source.slice(i + 2, end)
      if (end >= 0 && body.trim()) {
        flush(i)
        const lead = body.length - body.trimStart().length
        const bodyStart = i + 2 + lead
        out.push({ type: 'display', value: body.trim(), start: i, end: end + 2, bodyStart, bodyEnd: bodyStart + body.trim().length })
        i = end + 2
      } else if (end >= 0) {
        // `$$$$` o `$$  $$`: vuota, resta testo.
        pushText(source.slice(i, end + 2), i)
        i = end + 2
      } else {
        pushText('$$', i)
        i += 2
      }
      continue
    }
    const end = isSpace(source[i + 1]) ? -1 : findInlineEnd(source, i + 1)
    if (end >= 0) {
      flush(i)
      out.push({ type: 'inline', value: source.slice(i + 1, end), start: i, end: end + 1, bodyStart: i + 1, bodyEnd: end })
      i = end + 1
    } else {
      pushText('$', i)
      i++
    }
  }
  flush(source.length)
  return out
}

export function splitMath(source: string): MathSegment[] {
  return scanMath(source).map(({ type, value }) => ({ type, value }))
}

/** Vero se il testo contiene almeno una formula ben chiusa. */
export function hasMath(source: string): boolean {
  return splitMath(source).some((s) => s.type !== 'text')
}

/** Vero se il testo contiene almeno una formula in display. */
export function hasDisplayMath(source: string): boolean {
  return splitMath(source).some((s) => s.type === 'display')
}
