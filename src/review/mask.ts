// Modalità Completa: il campo `chiave` sparisce dal testo, sostituito da
// trattini. Si nascondono tutte le occorrenze, perché la seconda
// suggerirebbe la prima.

export type Range = [start: number, end: number]

export function keyRanges(text: string, key: string): Range[] {
  if (!key) return []
  const out: Range[] = []
  let from = 0
  for (;;) {
    const i = text.indexOf(key, from)
    if (i < 0) break
    out.push([i, i + key.length])
    from = i + key.length
  }
  return out
}

export function inRanges(i: number, ranges: Range[]): boolean {
  return ranges.some(([s, e]) => i >= s && i < e)
}

/** Il testo con la chiave a trattini: gli spazi restano, così si contano le parole. */
export function maskText(text: string, ranges: Range[], dash = '–'): string {
  return [...text].map((ch, i) => (inRanges(i, ranges) && ch !== ' ' ? dash : ch)).join('')
}
