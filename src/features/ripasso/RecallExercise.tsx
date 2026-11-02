import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Keyboard } from '../../components/Keyboard'
import { MathText } from '../../components/MathText'
import { hasMath } from '../../math/delimiters'
import { useI18n, useT } from '../../i18n/store'
import { useTuning } from '../../db/hooks'
import { alignWords, type DiffOp } from '../../review/similarity'
import { applyValue, freeWpm, startTyping } from '../../review/typing'

export interface RecallDone {
  wpm: number
  similarity: number
  typos: number
  activeMs: number
  ok: boolean
}

interface RecallExerciseProps {
  mode: 'nome' | 'memoria'
  /** Quello che va scritto: il titolo (Indovina il nome) o l'enunciato (A memoria). */
  reference: string
  /** Il testo mostrato come domanda in Indovina il nome. */
  prompt?: string
  /** La lettura a parole delle formule della scheda. */
  reading?: string
  saved?: string
  onDecide: (result: RecallDone) => void
  onNext: () => void
  showKeyboard: boolean
}

/** Indovina il nome e A memoria: scrivi senza aiuti, poi il confronto parola per parola. */
export function RecallExercise({ mode, reference, prompt, reading, saved, onDecide, onNext, showKeyboard }: RecallExerciseProps) {
  const { t, f } = useI18n()
  const tr = t.ripasso
  const minSimilarity = useTuning().ripasso.minSimilarity! / 100
  const [state, setState] = useState(() => startTyping(reference))
  const [checked, setChecked] = useState(false)
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  useEffect(() => {
    setState(startTyping(reference))
    setChecked(false)
    if (window.matchMedia('(pointer: fine)').matches) field.current?.focus({ preventScroll: true })
  }, [reference, mode])

  const result = checked ? alignWords(reference, state.typed) : null
  const suggestion = result ? result.similarity >= minSimilarity : false

  const check = () => {
    if (!state.typed.trim()) return
    setChecked(true)
  }

  const decide = (ok: boolean) => {
    if (!result) return
    onDecide({
      wpm: freeWpm(state),
      similarity: result.similarity,
      typos: state.corrections,
      activeMs: (state.lastAt ?? 0) - (state.startedAt ?? 0),
      ok,
    })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    if (mode === 'memoria' && !(e.ctrlKey || e.metaKey)) return
    e.preventDefault()
    if (saved) onNext()
    else if (!checked) check()
  }

  const fieldProps = {
    ref: field,
    id: 'recall',
    className: `field exercise__input${mode === 'memoria' ? ' exercise__area' : ''}`,
    value: state.typed,
    onChange: (e: { target: { value: string } }) => !checked && setState((s) => applyValue(s, e.target.value, Date.now(), false)),
    onKeyDown,
    onPaste: (e: { preventDefault: () => void }) => e.preventDefault(),
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    readOnly: checked,
    placeholder: mode === 'nome' ? tr.namePlaceholder : tr.memoryPlaceholder,
  }

  return (
    <>
      <section className="exercise" aria-label={tr.exercise}>
        {mode === 'nome' && prompt ? <MathText as="p" className="exercise__text exercise__text--plain" source={prompt} reading={reading} /> : null}
        <label htmlFor="recall" className="sr-only">
          {mode === 'nome' ? tr.namePlaceholder : tr.memoryLabel}
        </label>
        <div className={`exercise__row${mode === 'memoria' ? ' exercise__row--stack' : ''}`}>
          {mode === 'memoria' ? <textarea rows={5} {...fieldProps} /> : <input type="text" {...fieldProps} />}
          {!checked ? (
            <button type="button" className="btn btn--primary" onClick={check} disabled={!state.typed.trim()}>
              {tr.check}
            </button>
          ) : null}
          {!checked ? (
            <button type="button" className="btn" onClick={onNext}>
              {t.common.skip}
            </button>
          ) : null}
        </div>

        {result ? (
          <div className="compare">
            <p className="compare__score">
              <strong className="tnum">{f.number(result.similarity * 100, 0)}%</strong> {tr.similarity}
              <span>
                {' '}
                ({tr.distance({ n: result.distance }, f)})
              </span>
            </p>
            <p className="compare__words" aria-label={tr.compareLabel}>
              {result.ops.map((op, i) => (
                <Word key={i} op={op} />
              ))}
            </p>
            {mode === 'memoria' && hasMath(reference) ? (
              <div className="exercise__rendered">
                <p className="exercise__rendered-label">{t.math.withFormulas}</p>
                <MathText as="p" source={reference} reading={reading} />
              </div>
            ) : null}
            <p className="compare__legend">
              <span className="w w--ok">{tr.legendSame}</span> <span className="w w--sub">{tr.legendDiff}</span>{' '}
              <span className="w w--miss">{tr.legendMissing}</span> <span className="w w--extra">{tr.legendExtra}</span>
            </p>
            {saved ? (
              <div className="exercise__row">
                <p className="exercise__hint">{saved}</p>
                <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
                  {tr.nextCard}
                </button>
              </div>
            ) : (
              <div className="exercise__row compare__decide">
                <p className="compare__question">
                  {suggestion ? tr.verdictOk : tr.verdictKo} {tr.decide}
                </p>
                <button type="button" className={`btn${suggestion ? ' btn--primary' : ''}`} onClick={() => decide(true)}>
                  {tr.countRight}
                </button>
                <button type="button" className={`btn${suggestion ? '' : ' btn--primary'}`} onClick={() => decide(false)}>
                  {tr.countWrong}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="exercise__stats">
            <span>
              <strong className="tnum">{freeWpm(state, Date.now())}</strong> {t.common.wpm}
            </span>
            <span>
              <strong className="tnum">{state.corrections}</strong> {tr.correctedChars({ n: state.corrections }, f)}
            </span>
            <span className="exercise__hint">
              {mode === 'memoria' ? tr.ctrlEnterToCheck : tr.enterToCheck}
            </span>
          </p>
        )}
      </section>
      {showKeyboard ? (
        <div className="exercise__keyboard">
          <Keyboard errors={state.typoKeys} label={t.typing.keyboardRecall} />
          <p className="exercise__note">{tr.keyboardNote}</p>
        </div>
      ) : null}
    </>
  )
}

function Word({ op }: { op: DiffOp }) {
  const tr = useT().ripasso
  switch (op.op) {
    case 'equal':
      return <span className="w w--ok">{op.ref.text} </span>
    case 'sub':
      return (
        <span className="w w--sub" title={tr.youWrote({ text: op.ans.text })}>
          <s>{op.ans.text}</s> {op.ref.text}{' '}
        </span>
      )
    case 'del':
      return <span className="w w--miss">{op.ref.text} </span>
    case 'ins':
      return <span className="w w--extra">{op.ans.text} </span>
  }
}
