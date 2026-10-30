// Abbinamento di nomi (corsi, esami): puro, senza rete. Propone, non decide:
// chi chiama chiede sempre conferma all'utente.

export const MATCH_THRESHOLD = 0.5

const STOPWORDS = new Set([
  // italiano
  'di', 'a', 'da', 'in', 'su', 'per', 'con', 'tra', 'fra', 'il', 'lo', 'la', 'le', 'gli', 'i', 'un', 'uno', 'una', 'dei', 'del', 'della', 'delle', 'degli', 'e', 'ed',
  // inglese
  'the', 'of', 'and', 'for', 'to', 'an',
])

/** Minuscolo, senza accenti, apostrofi e punteggiatura come spazi, spazi singoli. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’‘`´]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Le parole che contano: senza articoli e preposizioni, cifre o almeno 3 lettere. */
export function tokens(s: string): string[] {
  return normalizeName(s)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && (/^\d+$/.test(t) || t.length >= 3))
}

const sameToken = (a: string, b: string): boolean => {
  if (a === b) return true
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  return short.length >= 4 && long.startsWith(short)
}

/** Somiglianza 0..1: parole in comune su parole totali (Jaccard con abbinamento uno a uno). */
export function matchScore(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.length || !tb.length) return 0
  const used = new Set<number>()
  let matched = 0
  for (const x of ta) {
    const j = tb.findIndex((y, i) => !used.has(i) && sameToken(x, y))
    if (j >= 0) {
      used.add(j)
      matched++
    }
  }
  return matched / (ta.length + tb.length - matched)
}

export interface MatchCandidate {
  id: string
  name: string
  code?: string
}

export interface Match {
  id: string
  score: number
}

const codeKey = (c?: string) => (c ?? '').toLowerCase().replace(/\s+/g, '')

/**
 * Il candidato migliore con punteggio almeno pari alla soglia, altrimenti null.
 * Lo stesso codice (senza badare a maiuscole e spazi, se non vuoto) vale 1.
 * A pari punteggio vince il primo. Non modifica nulla.
 */
export function bestMatch(name: string, candidates: MatchCandidate[], opts: { code?: string; threshold?: number } = {}): Match | null {
  const threshold = opts.threshold ?? MATCH_THRESHOLD
  const code = codeKey(opts.code)
  let best: Match | null = null
  for (const c of candidates) {
    const score = code && code === codeKey(c.code) ? 1 : matchScore(name, c.name)
    if (score >= threshold && (!best || score > best.score)) best = { id: c.id, score }
  }
  return best
}
