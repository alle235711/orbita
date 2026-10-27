import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FingerLegend, Keyboard } from '../../components/Keyboard'
import { formatDecimal } from '../../lib/dates'
import { strokeFor, strokeHint } from '../../review/keyboard'
import { MIN_ACCURACY } from '../../review/leitner'
import { inRanges, keyRanges } from '../../review/mask'
import { applyValue, charStates, startTyping, typingStats, type TypingState } from '../../review/typing'
import type { ReviewMode } from '../../db/schema'

export interface TypingDone {
  wpm: number
  accuracy: number
  wrongChars: number
  activeMs: number
}

interface TypingExerciseProps {
  text: string
  mode: Extract<ReviewMode, 'copia' | 'completa'>
  hiddenKey?: string
  /** Testo dopo il completamento: l'esito della revisione. */
  outcome?: string
  onDone: (result: TypingDone) => void
  onNext: () => void
  showKeyboard: boolean
  /** Etichetta del campo per i lettori di schermo. */
  inputLabel: string
  /** Nome della lezione o della scheda, per le statistiche per tasto (Dattilografia). */
  onKeyStats?: (state: TypingState) => void
  nextLabel?: string
}

/** Copia e Completa: il testo si colora mentre scrivi, la tastiera suggerisce il tasto. */
export function TypingExercise({ text, mode, hiddenKey, outcome, onDone, onNext, showKeyboard, inputLabel, onKeyStats, nextLabel = 'Scheda successiva' }: TypingExerciseProps) {
  const [state, setState] = useState(() => startTyping(text))
  const [now, setNow] = useState(() => Date.now())
  const finished = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const ranges = useMemo(() => (mode === 'completa' && hiddenKey ? keyRanges(text, hiddenKey) : []), [mode, hiddenKey, text])

  useEffect(() => {
    setState(startTyping(text))
    finished.current = false
    if (window.matchMedia('(pointer: fine)').matches) input.current?.focus({ preventScroll: true })
  }, [text, mode])

  // Il cronometro va solo mentre scrivi.
  useEffect(() => {
    if (!state.startedAt || finished.current) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [state.startedAt])

  const stats = typingStats(state, finished.current ? undefined : now)
  const states = charStates(state)
  const pos = state.typed.length
  const next = text[pos]
  const hiddenHere = next !== undefined && inRanges(pos, ranges)

  useEffect(() => {
    if (!stats.done || finished.current) return
    finished.current = true
    const final = typingStats(state)
    onKeyStats?.(state)
    onDone({
      wpm: final.wpm,
      accuracy: final.accuracy,
      wrongChars: state.wrongAt.length,
      activeMs: (state.lastAt ?? 0) - (state.startedAt ?? 0),
    })
  }, [stats.done, state, onDone, onKeyStats])

  const hint = stats.done
    ? outcome ?? 'Scheda completata'
    : next === undefined
      ? ''
      : hiddenHere
        ? 'Parte nascosta: scrivila a memoria'
        : strokeHint(next)

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && stats.done) {
      e.preventDefault()
      onNext()
    }
  }

  const reset = () => {
    setState(startTyping(text))
    finished.current = false
    input.current?.focus()
  }

  return (
    <>
      <section className="exercise" aria-label="Esercizio">
        <p className="exercise__text" aria-hidden="true">
          {[...text].map((ch, i) => {
            const st = states[i]!
            const masked = st !== 'ok' && st !== 'wrong' && inRanges(i, ranges) && ch !== ' '
            const shown = st === 'wrong' ? state.typed[i] === ' ' ? '·' : state.typed[i] : masked ? '–' : ch
            return (
              <span key={i} className={`c c--${st}${masked ? ' c--hidden' : ''}`}>
                {shown}
              </span>
            )
          })}
        </p>
        <div className="exercise__row">
          <label htmlFor="typer" className="sr-only">
            {inputLabel}
          </label>
          <input
            id="typer"
            ref={input}
            className="field exercise__input"
            type="text"
            value={state.typed}
            onChange={(e) => setState((s) => applyValue(s, e.target.value, Date.now()))}
            onKeyDown={onKeyDown}
            onPaste={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint={stats.done ? 'next' : 'done'}
            placeholder="Tocca qui e scrivi"
            readOnly={stats.done}
          />
          <button type="button" className="btn" onClick={reset}>
            Ricomincia
          </button>
          <button type="button" className={`btn ${stats.done ? 'btn--primary' : ''}`} onClick={onNext}>
            {stats.done ? nextLabel : 'Salta'}
          </button>
        </div>
        <p className="exercise__stats">
          <span>
            <strong className="tnum">{stats.wpm}</strong> parole al minuto
          </span>
          <span>
            <strong className="tnum">{state.hits + state.misses ? `${formatDecimal(stats.accuracy * 100, 0)}%` : '—'}</strong> di precisione
          </span>
          <span>
            <strong className="tnum">{Math.round(stats.progress * 100)}%</strong> della scheda
          </span>
          <span className={`exercise__hint${stats.done ? (stats.accuracy >= MIN_ACCURACY ? ' exercise__hint--ok' : ' exercise__hint--ko') : ''}`} aria-live="polite">
            {hint}
          </span>
        </p>
      </section>
      {showKeyboard ? (
        <div className="exercise__keyboard">
          <Keyboard
            next={stats.done || hiddenHere || next === undefined ? null : strokeFor(next)}
            errors={hiddenHere ? state.keyErrors : undefined}
            label={`Tastiera italiana dell’HP 250 G8 con i tasti colorati per dito. ${hint}`}
          />
          <FingerLegend />
        </div>
      ) : null}
    </>
  )
}
