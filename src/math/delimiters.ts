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

export function splitMath(source: string): MathSegment[] {
  const out: MathSegment[] = []
  let text = ''
  const pushText = (s: string) => {
    text += s
  }
  const flush = () => {
    if (text) out.push({ type: 'text', value: text })
    text = ''
  }

  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    if (ch === '\\' && source[i + 1] === '$') {
      pushText('$')
      i += 2
      continue
    }
    if (ch !== '$') {
      pushText(ch)
      i++
      continue
    }
    if (source[i + 1] === '$') {
      const end = findDisplayEnd(source, i + 2)
      const body = end < 0 ? '' : source.slice(i + 2, end)
      if (end >= 0 && body.trim()) {
        flush()
        out.push({ type: 'display', value: body.trim() })
        i = end + 2
      } else if (end >= 0) {
        // `$$$$` o `$$  $$`: vuota, resta testo.
        pushText(source.slice(i, end + 2))
        i = end + 2
      } else {
        pushText('$$')
        i += 2
      }
      continue
    }
    const end = isSpace(source[i + 1]) ? -1 : findInlineEnd(source, i + 1)
    if (end >= 0) {
      flush()
      out.push({ type: 'inline', value: source.slice(i + 1, end) })
      i = end + 1
    } else {
      pushText('$')
      i++
    }
  }
  flush()
  return out
}

/** Vero se il testo contiene almeno una formula ben chiusa. */
export function hasMath(source: string): boolean {
  return splitMath(source).some((s) => s.type !== 'text')
}

/** Vero se il testo contiene almeno una formula in display. */
export function hasDisplayMath(source: string): boolean {
  return splitMath(source).some((s) => s.type === 'display')
}
