import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from '../app/toast'
import { logSession, logWeight, logWorkout } from '../db/actions'
import type { Course, SessionType, WorkoutType } from '../db/schema'
import type { QuickKind } from '../i18n/dict/it/quicklog'
import { useI18n } from '../i18n/store'
import { todayISO } from '../lib/dates'
import { examsAhead } from '../rules/rules'
import { Sheet } from './Sheet'

type Kind = QuickKind

const KINDS: { id: Kind; minutes?: number }[] = [
  { id: 'studio', minutes: 90 },
  { id: 'lavoro', minutes: 60 },
  { id: 'arrampicata', minutes: 120 },
  { id: 'corsa', minutes: 40 },
  { id: 'palestra', minutes: 60 },
  { id: 'peso' },
  { id: 'lean', minutes: 30 },
  { id: 'elsa', minutes: 15 },
  { id: 'lettura', minutes: 30 },
]

const WORKOUT: Kind[] = ['arrampicata', 'corsa', 'palestra']

interface QuickLogProps {
  open: boolean
  onClose: () => void
  courses: Course[]
}

/** Il pannello "Registra" di Oggi (SPEC §3.1). */
export function QuickLog({ open, onClose, courses }: QuickLogProps) {
  const { t, f } = useI18n()
  const tq = t.quicklog
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
    if (!open) return
    setDate(todayISO())
    setError('')
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
        if (!(value > 20 && value < 300)) return setError(tq.errWeight)
        await logWeight(date, Math.round(value * 10) / 10)
        toast(tq.weightLogged({ kg: value }, f))
      } else {
        if (!(m > 0 && m <= 24 * 60)) return setError(tq.errMinutes)
        if (WORKOUT.includes(kind)) {
          await logWorkout({ date, type: kind as WorkoutType, minutes: m })
        } else if (kind === 'elsa') {
          const s = score.trim() ? Number(score.replace(',', '.')) : undefined
          if (s !== undefined && !(s >= 0 && s <= 100)) return setError(tq.errScore)
          await logSession({ date, type: 'inglese', minutes: m, score: s, notes: t.legacy.elsa })
        } else {
          await logSession({ date, type: kind as SessionType, minutes: m, courseId: kind === 'studio' ? courseId || undefined : undefined })
        }
        toast(tq.logged({ minutes: m, kind }, f))
      }
      setScore('')
      setKg('')
      onClose()
    } catch {
      setError(tq.errSave)
    }
  }

  return (
    <Sheet open={open} title={tq.title} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <div className="choices" role="radiogroup" aria-label={tq.groupLabel}>
          {KINDS.map((k) => (
            <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="chip" onClick={() => pick(k.id)}>
              {tq.kind[k.id]}
            </button>
          ))}
        </div>

        <div className="form-grid">
          {kind === 'peso' ? (
            <label className="form-field">
              <span>{tq.weight}</span>
              <input className="field" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={tq.weightPlaceholder} required />
            </label>
          ) : (
            <label className="form-field">
              <span>{tq.minutes}</span>
              <input className="field" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} required />
            </label>
          )}
          {kind === 'studio' ? (
            <label className="form-field form-field--wide">
              <span>{tq.course}</span>
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
            <label className="form-field">
              <span>{tq.score}</span>
              <input className="field" inputMode="decimal" value={score} onChange={(e) => setScore(e.target.value)} placeholder={tq.scorePlaceholder} />
            </label>
          ) : null}
          <label className="form-field">
            <span>{tq.day}</span>
            <input className="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} />
          </label>
        </div>

        <p className="form-error" role="alert">
          {error}
        </p>

        <div className="sheet-actions">
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn--primary">
            {tq.submit}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
