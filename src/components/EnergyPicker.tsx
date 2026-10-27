import { useRef, type KeyboardEvent } from 'react'
import { DiskGlyph } from '../art/BlackHole'
import { DEFAULT_ENERGY, ENERGY, ENERGY_LEVELS, type Energy } from '../lib/energy'
import './EnergyPicker.css'

interface EnergyPickerProps {
  value: Energy | undefined
  onChange: (energy: Energy) => void
  labelledBy: string
}

/** "Quanto mangia il tuo buco nero oggi?": radiogroup a cinque stati. */
export function EnergyPicker({ value, onChange, labelledBy }: EnergyPickerProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  // Senza scelta, il tasto Tab porta sul livello mostrato di predefinito.
  const focusable = value ?? DEFAULT_ENERGY

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    const jump = e.key === 'Home' ? 1 : e.key === 'End' ? 5 : undefined
    if (!delta && !jump) return
    e.preventDefault()
    const next = (jump ?? (((focusable - 1 + delta! + 5) % 5) + 1)) as Energy
    onChange(next)
    refs.current[next - 1]?.focus()
  }

  return (
    <div className="energy" role="radiogroup" aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {ENERGY_LEVELS.map((level) => {
        const s = ENERGY[level]
        const on = level === value
        return (
          <button
            key={level}
            ref={(el) => {
              refs.current[level - 1] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${s.name}, ${s.word}`}
            tabIndex={level === focusable ? 0 : -1}
            className="energy__option"
            style={{ ['--c' as string]: s.color }}
            onClick={() => onChange(level)}
          >
            <DiskGlyph level={level} color={on ? '#070A16' : s.color} />
            <span className="energy__name">{s.name}</span>
            <span className="energy__word">{s.word}</span>
          </button>
        )
      })}
    </div>
  )
}
