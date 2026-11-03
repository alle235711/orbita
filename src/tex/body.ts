// Dal corpo di un ambiente .tex al testo di una scheda: formule nei
// delimitatori `$...$` e `$$...$$` che l'app sa rendere, `\label` tolti, spazi
// e a capo ridotti a uno spazio. Funzioni pure.

import { scanMath } from '../math/delimiters'

/** Ambienti di formula in display e come racchiuderli per KaTeX (null = senza). */
const DISPLAY_ENVS: Record<string, string | null> = {
  equation: null,
  'equation*': null,
  displaymath: null,
  align: 'aligned',
  'align*': 'aligned',
  gather: 'gathered',
  'gather*': 'gathered',
  multline: 'gathered',
  'multline*': 'gathered',
}

const LABEL = /\\label\s*\{[^{}]*\}/g

export function stripLabels(src: string): string {
  return src.replace(LABEL, '')
}

export const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function wrapDisplay(env: string, inner: string): string {
  const wrapper = DISPLAY_ENVS[env]
  const body = inner.trim()
  return wrapper ? `$$\\begin{${wrapper}}${body}\\end{${wrapper}}$$` : `$$${body}$$`
}

/** La fine di un `$...$` o `$$...$$` che comincia in `i` (posizione subito dopo), o -1. */
function mathEnd(src: string, i: number): number {
  const delim = src[i + 1] === '$' ? '$$' : '$'
  for (let j = i + delim.length; j < src.length; j++) {
    if (src[j] === '\\') j++
    else if (src.startsWith(delim, j)) return j + delim.length
  }
  return -1
}

/**
 * Porta le formule di LaTeX puro nei delimitatori dell'app: `\[...\]`, `equation`,
 * `align`... diventano `$$...$$`, `\(...\)` diventa `$...$`. Le formule già tra
 * `$` restano come sono. `\%` fuori dalle formule diventa un percento.
 */
export function convertMath(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const ch = src[i]!
    if (ch === '$') {
      const end = mathEnd(src, i)
      if (end >= 0) {
        out += src.slice(i, end)
        i = end
        continue
      }
      out += ch
      i++
      continue
    }
    if (ch !== '\\') {
      out += ch
      i++
      continue
    }
    const next = src[i + 1]
    if (next === '[' || next === '(') {
      const close = next === '[' ? '\\]' : '\\)'
      const end = src.indexOf(close, i + 2)
      if (end >= 0) {
        const inner = src.slice(i + 2, end).trim()
        out += next === '[' ? `$$${inner}$$` : `$${inner}$`
        i = end + 2
        continue
      }
    }
    if (next === '%') {
      out += '%'
      i += 2
      continue
    }
    if (src.startsWith('\\begin', i)) {
      const open = /\\begin\s*\{([^{}]*)\}/y
      open.lastIndex = i
      const m = open.exec(src)
      const env = m?.[1]?.trim()
      if (m && env !== undefined && env in DISPLAY_ENVS) {
        const close = new RegExp(`\\\\end\\s*\\{\\s*${escapeRegExp(env)}\\s*\\}`, 'g')
        close.lastIndex = i + m[0].length
        const c = close.exec(src)
        if (c) {
          out += wrapDisplay(env, src.slice(i + m[0].length, c.index))
          i = c.index + c[0].length
          continue
        }
      }
    }
    out += ch + (next ?? '')
    i += 2
  }
  return out
}

/** Il testo della scheda: senza `\label`, con le formule nei delimitatori dell'app e su una riga. */
export function bodyToText(raw: string): string {
  return squash(convertMath(stripLabels(raw)))
}

/**
 * Un titolo: senza `\label`, su una riga e, fuori dalle formule, senza le graffe
 * che in TeX servono solo a raggruppare ("di {Cauchy}" si legge "di Cauchy").
 */
export function cleanTitle(raw: string): string {
  const src = stripLabels(raw)
  const plain = scanMath(src)
    .map((s) => {
      const piece = src.slice(s.start, s.end)
      return s.type === 'text' ? piece.replace(/(?<!\\)[{}]/g, '') : piece
    })
    .join('')
  return squash(plain)
}
