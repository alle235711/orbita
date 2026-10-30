import { MAX_OTHER_DAYS } from '../i18n/lang'
import { useFmt } from '../i18n/store'
import './WeekdayToggles.css'

const WEEK = [1, 2, 3, 4, 5, 6, 7]

interface WeekdayTogglesProps {
  /** Giorni ISO 1..7 scelti. */
  value: number[]
  onChange: (days: number[]) => void
  /** Id dell'etichetta che nomina il gruppo. */
  labelledBy: string
}

/** I sette giorni come interruttori; al massimo tre scelti, gli altri si spengono. */
export function WeekdayToggles({ value, onChange, labelledBy }: WeekdayTogglesProps) {
  const f = useFmt()
  const full = value.length >= MAX_OTHER_DAYS
  return (
    <div className="weekdays" role="group" aria-labelledby={labelledBy}>
      {WEEK.map((day) => {
        const on = value.includes(day)
        return (
          <button
            key={day}
            type="button"
            className="chip"
            aria-pressed={on}
            aria-label={f.weekdayName(day)}
            disabled={full && !on}
            onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day])}
          >
            {f.weekdayShort(day)}
          </button>
        )
      })}
    </div>
  )
}
