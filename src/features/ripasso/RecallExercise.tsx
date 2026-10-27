import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Keyboard } from '../../components/Keyboard'
import { formatDecimal } from '../../lib/dates'
import { MIN_SIMILARITY } from '../../review/leitner'
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
  saved?: string
  onDecide: (result: RecallDone) => void
  onNext: () => void
  showKeyboard: boolean
}

/** Indovina il nome e A memoria: scrivi senza aiuti, poi il confronto parola per parola. */
export function RecallExercise({ mode, reference, prompt, saved, onDecide, onNext, showKeyboard }: RecallExerciseProps) {
  const [state, setState] = useState(() => startTyping(reference))
  const [checked, setChecked] = useState(false)
  const field = useRef<HTMLTextAreaElement & HTMLInputElement>(null)

  useEffect(() => {
    setState(startTyping(reference))
    setChecked(false)
    if (window.matchMedia('(pointer: fine)').matches) field.current?.focus({ preventScroll: true })
  }, [reference, mode])

  const result = checked ? alignWords(reference, state.typed) : null
  const suggestion = result ? result.similarity >= MIN_SIMILARITY : false

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
    placeholder: mode === 'nome' ? 'Il nome della scheda' : 'Scrivi l’enunciato a memoria',
  }

  return (
    <>
      <section className="exercise" aria-label="Esercizio">
        {mode === 'nome' && prompt ? <p className="exercise__text exercise__text--plain">{prompt}</p> : null}
        <label htmlFor="recall" className="sr-only">
          {mode === 'nome' ? 'Il nome della scheda' : 'L’enunciato, a memoria'}
        </label>
        <div className={`exercise__row${mode === 'memoria' ? ' exercise__row--stack' : ''}`}>
          {mode === 'memoria' ? <textarea rows={5} {...fieldProps} /> : <input type="text" {...fieldProps} />}
          {!checked ? (
            <button type="button" className="btn btn--primary" onClick={check} disabled={!state.typed.trim()}>
              Controlla
            </button>
          ) : null}
          {!checked ? (
            <button type="button" className="btn" onClick={onNext}>
              Salta
            </button>
          ) : null}
        </div>

        {result ? (
          <div className="compare">
            <p className="compare__score">
              <strong className="tnum">{formatDecimal(result.similarity * 100, 0)}%</strong> di somiglianza
              <span>
                {' '}
                ({result.distance === 0 ? 'identico' : `${result.distance} ${result.distance === 1 ? 'parola diversa' : 'parole diverse'}`})
              </span>
            </p>
            <p className="compare__words" aria-label="Confronto parola per parola con il testo di riferimento">
              {result.ops.map((op, i) => (
                <Word key={i} op={op} />
              ))}
            </p>
            <p className="compare__legend">
              <span className="w w--ok">uguale</span> <span className="w w--sub">diversa</span> <span className="w w--miss">mancante</span>{' '}
              <span className="w w--extra">in più</span>
            </p>
            {saved ? (
              <div className="exercise__row">
                <p className="exercise__hint">{saved}</p>
                <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
                  Scheda successiva
                </button>
              </div>
            ) : (
              <div className="exercise__row compare__decide">
                <p className="compare__question">
                  {suggestion ? 'Sopra l’85%: di solito si conta giusta.' : 'Sotto l’85%: di solito si conta sbagliata.'} Decidi tu.
                </p>
                <button type="button" className={`btn${suggestion ? ' btn--primary' : ''}`} onClick={() => decide(true)}>
                  Conta come giusta
                </button>
                <button type="button" className={`btn${suggestion ? '' : ' btn--primary'}`} onClick={() => decide(false)}>
                  Conta come sbagliata
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="exercise__stats">
            <span>
              <strong className="tnum">{freeWpm(state, Date.now())}</strong> parole al minuto
            </span>
            <span>
              <strong className="tnum">{state.corrections}</strong> {state.corrections === 1 ? 'carattere corretto' : 'caratteri corretti'}
            </span>
            <span className="exercise__hint">
              {mode === 'memoria' ? 'Ctrl + Invio per controllare' : 'Invio per controllare'}
            </span>
          </p>
        )}
      </section>
      {showKeyboard ? (
        <div className="exercise__keyboard">
          <Keyboard errors={state.typoKeys} label="Tastiera dell’HP 250 G8: in rosso i tasti degli errori di battitura." />
          <p className="exercise__note">A memoria la tastiera mostra solo gli errori di battitura.</p>
        </div>
      ) : null}
    </>
  )
}

function Word({ op }: { op: DiffOp }) {
  switch (op.op) {
    case 'equal':
      return <span className="w w--ok">{op.ref.text} </span>
    case 'sub':
      return (
        <span className="w w--sub" title={`Hai scritto: ${op.ans.text}`}>
          <s>{op.ans.text}</s> {op.ref.text}{' '}
        </span>
      )
    case 'del':
      return <span className="w w--miss">{op.ref.text} </span>
    case 'ins':
      return <span className="w w--extra">{op.ans.text} </span>
  }
}
