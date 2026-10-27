// Confronto a memoria (SPEC §3.5): distanza di edit sulle parole,
// normalizzata, e allineamento parola per parola da mostrare.

const EDGE = /^[\s.,;:!?()[\]{}"'«»“”‘’…-]+|[\s.,;:!?()[\]{}"'«»“”‘’…-]+$/g

export interface Token {
  /** La parola come l'hai scritta. */
  text: string
  /** Minuscola e senza punteggiatura ai bordi: si confronta questa. */
  norm: string
}

export function tokenize(s: string): Token[] {
  return s
    .split(/\s+/)
    .map((text) => ({ text, norm: text.toLowerCase().replace(EDGE, '').replace(/[’‘]/g, "'") }))
    .filter((t) => t.norm.length > 0)
}

export type DiffOp =
  | { op: 'equal'; ref: Token; ans: Token }
  | { op: 'sub'; ref: Token; ans: Token }
  | { op: 'del'; ref: Token }
  | { op: 'ins'; ans: Token }

/** Allineamento di Levenshtein sulle parole: uguali, sostituite, mancanti, in più. */
export function alignWords(reference: string, answer: string): { ops: DiffOp[]; distance: number; similarity: number } {
  const a = tokenize(reference)
  const b = tokenize(answer)
  const n = a.length
  const m = b.length
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1]!.norm === b[j - 1]!.norm ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
    }
  }
  const ops: DiffOp[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + (a[i - 1]!.norm === b[j - 1]!.norm ? 0 : 1)) {
      ops.push(a[i - 1]!.norm === b[j - 1]!.norm ? { op: 'equal', ref: a[i - 1]!, ans: b[j - 1]! } : { op: 'sub', ref: a[i - 1]!, ans: b[j - 1]! })
      i--
      j--
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + 1) {
      ops.push({ op: 'del', ref: a[i - 1]! })
      i--
    } else {
      ops.push({ op: 'ins', ans: b[j - 1]! })
      j--
    }
  }
  ops.reverse()
  const distance = d[n]![m]!
  const longest = Math.max(n, m)
  return { ops, distance, similarity: longest ? 1 - distance / longest : 1 }
}

export function similarity(reference: string, answer: string): number {
  return alignWords(reference, answer).similarity
}
