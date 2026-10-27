import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { toast } from '../app/toast'
import { logSession, logWeight, logWorkout } from '../db/actions'
import type { Course, SessionType, WorkoutType } from '../db/schema'
import { formatMinutes, todayISO } from '../lib/dates'
import { examsAhead } from '../rules/rules'
import './QuickLog.css'

type Kind = 'studio' | 'lavoro' | 'arrampicata' | 'corsa' | 'palestra' | 'peso' | 'lean' | 'elsa' | 'lettura'

const KINDS: { id: Kind; label: string; minutes?: number }[] = [
  { id: 'studio', label: 'Studio', minutes: 90 },
  { id: 'lavoro', label: 'Lavoro', minutes: 60 },
  { id: 'arrampicata', label: 'Arrampicata', minutes: 120 },
  { id: 'corsa', label: 'Corsa', minutes: 40 },
  { id: 'palestra', label: 'Palestra', minutes: 60 },
  { id: 'peso', label: 'Peso' },
  { id: 'lean', label: 'Lean', minutes: 30 },
  { id: 'elsa', label: 'ELSA', minutes: 15 },
  { id: 'lettura', label: 'Lettura', minutes: 30 },
]

const WORKOUT: Kind[] = ['arrampicata', 'corsa', 'palestra']

interface QuickLogProps {
  open: boolean
  onClose: () => void
  courses: Course[]
}

/** Il pannello "Registra" di Oggi (SPEC §3.1). */
export function QuickLog({ open, onClose, courses }: QuickLogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const today = todayISO()
  const [kind, setKind] = useState<Kind>('studio')
  const [minutes, setMinutes] = useState('90')
  const [date, setDate] = useState(today)
  const [courseId, setCourseId] = useState('')
  const [score, setScore] = useState('')
  const [kg, setKg] = useState('')
  const [error, setError] = useState('')

  const sortedCourses = useMemo(() => {
    const upcoming = examsAhead(courses, today).map((e) => e.course)
    return [...upcoming, ...courses.filter((c) => !upcoming.includes(c))]
  }, [courses, today])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setDate(todayISO())
      setError('')
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!courseId && sortedCourses[0]) setCourseId(sortedCourses[0].id)
  }, [courseId, sortedCourses])

  const pick = (next: Kind) => {
    setKind(next)
    const preset = KINDS.find((k) => k.id === next)?.minutes
    if (preset) setMinutes(String(preset))
    setError('')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const m = Math.round(Number(minutes))
    try {
      if (kind === 'peso') {
        const value = Number(kg.replace(',', '.'))
        if (!(value > 20 && value < 300)) return setError('Scrivi il peso in chilogrammi, per esempio 72,5.')
        await logWeight(date, Math.round(value * 10) / 10)
        toast(`Registrato il peso: ${value.toLocaleString('it-IT')} kg.`)
      } else {
        if (!(m > 0 && m <= 24 * 60)) return setError('Scrivi quanti minuti, da 1 a 1440.')
        const label = KINDS.find((k) => k.id === kind)!.label
        if (WORKOUT.includes(kind)) {
          await logWorkout({ date, type: kind as WorkoutType, minutes: m })
        } else if (kind === 'elsa') {
          const s = score.trim() ? Number(score.replace(',', '.')) : undefined
          if (s !== undefined && !(s >= 0 && s <= 100)) return setError('Il punteggio ELSA va da 0 a 100.')
          await logSession({ date, type: 'inglese', minutes: m, score: s, notes: 'ELSA' })
        } else {
          await logSession({ date, type: kind as SessionType, minutes: m, courseId: kind === 'studio' ? courseId || undefined : undefined })
        }
        toast(`Registrati ${formatMinutes(m)} di ${label === 'ELSA' ? 'ELSA' : label.toLowerCase()}.`)
      }
      setScore('')
      setKg('')
      onClose()
    } catch {
      setError('Non sono riuscito a salvare. Riprova.')
    }
  }

  return (
    <dialog
      ref={ref}
      className="quicklog"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <form className="quicklog__form" onSubmit={(e) => void submit(e)}>
        <div className="quicklog__head">
          <h2 id={titleId}>Registra</h2>
          <button type="button" className="quicklog__close" onClick={onClose} aria-label="Chiudi">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="quicklog__kinds" role="radiogroup" aria-label="Cosa registri">
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="chip" onClick={() => pick(k.id)}>
              {k.label}
            </button>
          ))}
        </div>

        <div className="quicklog__fields">
          {kind === 'peso' ? (
            <label className="quicklog__field">
              <span>Chilogrammi</span>
              <input className="field" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="72,5" required />
            </label>
          ) : (
            <label className="quicklog__field">
              <span>Minuti</span>
              <input className="field" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
            </label>
          )}
          {kind === 'studio' ? (
            <label className="quicklog__field quicklog__field--wide">
              <span>Corso</span>
              <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                {sortedCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {kind === 'elsa' ? (
            <label className="quicklog__field">
              <span>Punteggio</span>
              <input className="field" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder="0–100" />
            </label>
          ) : null}
          <label className="quicklog__field">
            <span>Giorno</span>
            <input className="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </label>
        </div>

        <p className="quicklog__error" role="alert">
          {error}
        </p>

        <div className="quicklog__actions">
          <button type="button" className="btn" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn--primary">
            Registra
          </button>
        </div>
      </form>
    </dialog>
  )
}
