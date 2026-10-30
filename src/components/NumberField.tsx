import { useEffect, useId, useState } from 'react'
import './NumberField.css'

interface NumberFieldProps {
  label: string
  value: number | undefined
  onCommit: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  /** Se vero, un campo vuoto vale "nessun valore". */
  optional?: boolean
  /**
   * Se vero il valore scritto non si corregge: arriva com'è a chi ascolta, che
   * mostra l'errore. Senza, si riporta dentro i limiti e sul passo.
   */
  strict?: boolean
  /** Segnala il campo come non valido a chi legge lo schermo. */
  invalid?: boolean
}

/** Campo numerico che si conferma quando esci o premi Invio: si può scrivere con calma, senza scatti. */
export function NumberField({ label, value, onCommit, min, max, step, placeholder, optional, strict, invalid }: NumberFieldProps) {
  const id = useId()
  const [text, setText] = useState(value === undefined ? '' : String(value))
  useEffect(() => setText(value === undefined ? '' : String(value)), [value])

  const commit = () => {
    const raw = text.trim().replace(',', '.')
    if (!raw) {
      if (optional) onCommit(undefined)
      else setText(value === undefined ? '' : String(value))
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return setText(value === undefined ? '' : String(value))
    if (strict) {
      setText(String(n))
      if (n !== value) onCommit(n)
      return
    }
    const s = step ?? 1
    const stepped = Math.round(n / s) * s
    const next = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Number(stepped.toFixed(4))))
    setText(String(next))
    if (next !== value) onCommit(next)
  }

  return (
    <div className="number-field">
      <label className="date-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="field"
        type="text"
        inputMode={step && step < 1 ? 'decimal' : 'numeric'}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
      />
    </div>
  )
}
