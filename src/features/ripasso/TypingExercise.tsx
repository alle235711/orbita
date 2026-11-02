import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { FingerLegend, Keyboard } from '../../components/Keyboard'
import { MathText } from '../../components/MathText'
import { hasMath } from '../../math/delimiters'
import { useI18n } from '../../i18n/store'
import { strokeFor, strokeHint } from '../../review/keyboard'
import { useTuning } from '../../db/hooks'
import { inRanges, keyRanges } from '../../review/mask'
import { applyValue, charStates, startTyping, typingStats } from '../../review/typing'
import type { ReviewMode } from '../../db/schema'

export interface TypingDone {
  wpm: number
  accuracy: number
  wrongChars: number
  activeMs: number
  chars: number
  keyErrors: Record<string, number>
  keyHits: Record<string, number>
}

interface TypingExerciseProps {
  text: string
  mode: Extract<ReviewMode, 'copia' | 'completa'>
  hiddenKey?: string
  /** La lettura a parole delle formule della scheda. */
  reading?: string
  /** Testo dopo il completamento: l'esito della revisione. */
  outcome?: string
  onDone: (result: TypingDone) => void
  onNext: () => void
  showKeyboard: boolean
  /** Etichetta del campo per i lettori di schermo. */
  inputLabel: string
  nextLabel?: string
}

/** Copia e Completa: il testo si colora mentre scrivi, la tastiera suggerisce il tasto. */
export function TypingExercise({ text, mode, hiddenKey, reading, outcome, onDone, onNext, showKeyboard, inputLabel, nextLabel }: TypingExerciseProps) {
  const { t, f } = useI18n()
  const tr = t.ripasso
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

  const tuning = useTuning()
  const minAccuracy = tuning.ripasso.minAccuracy! / 100
  const minSeconds = tuning.dattilografia.minSeconds!
  const stats = typingStats(state, finished.current ? undefined : now, minSeconds)
  const states = charStates(state)
  const pos = state.typed.length
  const next = text[pos]
  const hiddenHere = next !== undefined && inRanges(pos, ranges)
  // Si batte sempre il sorgente; la resa delle formule si vede in Copia e, in Completa, solo alla fine.
  const showRendered = hasMath(text) && (mode === 'copia' || stats.done)

  useEffect(() => {
    if (!stats.done || finished.current) return
    finished.current = true
    const final = typingStats(state, undefined, minSeconds)
    onDone({
      wpm: final.wpm,
      accuracy: final.accuracy,
      wrongChars: state.wrongAt.length,
      activeMs: (state.lastAt ?? 0) - (state.startedAt ?? 0),
      chars: state.target.length,
      keyErrors: state.keyErrors,
      keyHits: state.keyHits,
    })
  }, [stats.done, state, onDone])

  const hint = stats.done
    ? outcome ?? tr.completed
    : next === undefined
      ? ''
      : hiddenHere
        ? tr.hiddenPart
        : strokeHint(next, t.typing.hint)

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
      <section className="exercise" aria-label={tr.exercise}>
        {showRendered ? (
          <div className="exercise__rendered">
            <p className="exercise__rendered-label">{t.math.withFormulas}</p>
            <MathText as="p" source={text} reading={reading} />
          </div>
        ) : null}
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
            placeholder={tr.typingPlaceholder}
            readOnly={stats.done}
          />
          <button type="button" className="btn" onClick={reset}>
            {tr.restart}
          </button>
          <button type="button" className={`btn ${stats.done ? 'btn--primary' : ''}`} onClick={onNext}>
            {stats.done ? (nextLabel ?? tr.nextCard) : tr.skip}
          </button>
        </div>
        <p className="exercise__stats">
          <span>
            <strong className="tnum">{stats.wpm}</strong> {t.common.wpm}
          </span>
          <span>
            <strong className="tnum">{state.hits + state.misses ? `${f.number(stats.accuracy * 100, 0)}%` : '—'}</strong> {tr.precision}
          </span>
          <span>
            <strong className="tnum">{Math.round(stats.progress * 100)}%</strong> {tr.ofCard}
          </span>
          <span className={`exercise__hint${stats.done ? (stats.accuracy >= minAccuracy ? ' exercise__hint--ok' : ' exercise__hint--ko') : ''}`} aria-live="polite">
            {hint}
          </span>
        </p>
      </section>
      {showKeyboard ? (
        <div className="exercise__keyboard">
          <Keyboard
            next={stats.done || hiddenHere || next === undefined ? null : strokeFor(next)}
            errors={hiddenHere ? state.keyErrors : undefined}
            label={t.typing.keyboardTyping({ hint })}
          />
          <FingerLegend />
        </div>
      ) : null}
    </>
  )
}
