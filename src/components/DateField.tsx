import { useId } from 'react'
import { useT } from '../i18n/store'
import { isMonthOnly, resolveDate } from '../lib/dates'
import './DateField.css'

interface DateFieldProps {
  label: string
  /** 'YYYY-MM-DD', 'YYYY-MM' o vuoto */
  value: string | undefined
  onChange: (value: string | undefined) => void
  /** Permette di dire "conosco solo il mese". */
  allowMonthOnly?: boolean
}

export function DateField({ label, value, onChange, allowMonthOnly = false }: DateFieldProps) {
  const id = useId()
  const t = useT()
  const monthOnly = !!value && isMonthOnly(value)

  const change = (next: string, keepMonthOnly = monthOnly) => {
    if (!next) return onChange(undefined)
    onChange(keepMonthOnly ? next.slice(0, 7) : next)
  }

  return (
    <div className="date-field">
      <label className="date-field__label" htmlFor={id}>
        {label}
      </label>
      <div className="date-field__row">
        <input
          id={id}
          className="field date-field__input"
          type="date"
          value={value ? resolveDate(value) : ''}
          onChange={(e) => change(e.target.value)}
        />
        {allowMonthOnly ? (
          <label className="date-field__check">
            <input
              type="checkbox"
              checked={monthOnly}
              disabled={!value}
              onChange={(e) => value && change(resolveDate(value), e.target.checked)}
            />
            {t.common.dayTbd}
          </label>
        ) : null}
      </div>
    </div>
  )
}
