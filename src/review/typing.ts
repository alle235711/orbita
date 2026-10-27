// Motore di battitura: confronta quello che scrivi con il testo di
// riferimento, carattere per carattere, e tiene i conti per tasto.
// Lavora sul valore del campo (come l'input del mockup), quindi funziona
// con la tastiera fisica, con quella dell'iPad e con l'autocorrezione.

import { keyIdFor } from './keyboard'

export interface TypingState {
  target: string
  typed: string
  /** Battute giuste e sbagliate, correzioni comprese: servono alla precisione. */
  hits: number
  misses: number
  /** Caratteri cancellati con Backspace. */
  corrections: number
  /** Posizioni sbagliate almeno una volta. */
  wrongAt: number[]
  /** Per tasto (quello che andava premuto): tentativi ed errori. */
  keyHits: Record<string, number>
  keyErrors: Record<string, number>
  /** Tasti dei caratteri cancellati: gli errori di battitura nelle modalità a memoria. */
  typoKeys: Record<string, number>
  startedAt?: number
  lastAt?: number
}

export type CharState = 'ok' | 'wrong' | 'current' | 'pending'

export function startTyping(target: string): TypingState {
  return { target, typed: '', hits: 0, misses: 0, corrections: 0, wrongAt: [], keyHits: {}, keyErrors: {}, typoKeys: {} }
}

/**
 * La punteggiatura "intelligente" di iPad e Android (apostrofi curvi,
 * virgolette, puntini) diventa quella della tastiera del PC.
 */
export function normalizeTyped(value: string): string {
  return value
    .replace(/[‘’‛ʼ´`]/g, "'")
    .replace(/[“”„«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/ /g, ' ')
}

const bump = (map: Record<string, number>, key: string | null) => {
  if (key) map[key] = (map[key] ?? 0) + 1
}

/** Applica il nuovo valore del campo: aggiunte, cancellazioni o sostituzioni. */
export function applyValue(state: TypingState, raw: string, now: number, limit = true): TypingState {
  let value = normalizeTyped(raw)
  if (limit) value = value.slice(0, state.target.length)
  if (value === state.typed) return state
  const prev = state.typed
  let p = 0
  while (p < prev.length && p < value.length && prev[p] === value[p]) p++

  const next: TypingState = {
    ...state,
    typed: value,
    keyHits: { ...state.keyHits },
    keyErrors: { ...state.keyErrors },
    typoKeys: { ...state.typoKeys },
    wrongAt: state.wrongAt,
    startedAt: state.startedAt ?? now,
    lastAt: now,
  }

  const removed = prev.slice(p)
  if (removed) {
    next.corrections += removed.length
    for (const ch of removed) bump(next.typoKeys, keyIdFor(ch))
  }

  const wrong = new Set(state.wrongAt)
  const added = value.slice(p)
  for (let i = 0; i < added.length; i++) {
    const pos = p + i
    const expected = state.target[pos]
    if (expected === undefined) continue
    const key = keyIdFor(expected)
    bump(next.keyHits, key)
    if (added[i] === expected) next.hits++
    else {
      next.misses++
      bump(next.keyErrors, key)
      wrong.add(pos)
    }
  }
  next.wrongAt = [...wrong].sort((a, b) => a - b)
  return next
}

export interface TypingStats {
  correctChars: number
  /** 0–1 sulle battute, correzioni comprese. */
  accuracy: number
  wpm: number
  /** 0–1 */
  progress: number
  done: boolean
  /** Il testo finale coincide con quello di riferimento. */
  exact: boolean
}

export function typingStats(state: TypingState, now?: number): TypingStats {
  let correctChars = 0
  for (let i = 0; i < state.typed.length; i++) if (state.typed[i] === state.target[i]) correctChars++
  const strokes = state.hits + state.misses
  const end = now ?? state.lastAt ?? state.startedAt
  const minutes = state.startedAt !== undefined && end !== undefined ? Math.max(3000, end - state.startedAt) / 60_000 : 0
  return {
    correctChars,
    accuracy: strokes ? state.hits / strokes : 1,
    wpm: minutes ? Math.round(correctChars / 5 / minutes) : 0,
    progress: state.target.length ? Math.min(1, state.typed.length / state.target.length) : 0,
    done: state.target.length > 0 && state.typed.length >= state.target.length,
    exact: state.typed === state.target,
  }
}

/** Parole al minuto per un testo libero (modalità a memoria): tutti i caratteri contano. */
export function freeWpm(state: TypingState, now?: number): number {
  const end = now ?? state.lastAt
  if (state.startedAt === undefined || end === undefined) return 0
  return Math.round(state.typed.length / 5 / (Math.max(3000, end - state.startedAt) / 60_000))
}

export function charStates(state: TypingState): CharState[] {
  return [...state.target].map((ch, i) => {
    if (i < state.typed.length) return state.typed[i] === ch ? 'ok' : 'wrong'
    return i === state.typed.length ? 'current' : 'pending'
  })
}

/** Il prossimo carattere da scrivere, se c'è. */
export function nextChar(state: TypingState): string | undefined {
  return state.target[state.typed.length]
}
