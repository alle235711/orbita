import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from '../app/toast'
import { logSession, logWeight, logWorkout } from '../db/actions'
import { useModules, useTuning } from '../db/hooks'
import type { Course, SessionType, WorkoutType } from '../db/schema'
import { useI18n } from '../i18n/store'
import { todayISO } from '../lib/dates'
import { moduleLabel, quickLogKinds, type QuickLogKind } from '../modules/registry'
import { DEFAULT_MODULES, type ModulesSettings } from '../modules/types'
import type { Tuning } from '../rules/defaults'
import { examsAhead } from '../rules/rules'
import { Sheet } from './Sheet'

type Kind = QuickLogKind

const WORKOUT: Kind[] = ['arrampicata', 'palestra', 'corsa', 'nuoto', 'altro']

/** I minuti proposti per tipo: dal gruppo `registra`, o dal tipo di sport. */
function presetMinutes(kind: Kind, tuning: Tuning, modules: ModulesSettings): number | undefined {
  const r = tuning.registra
  switch (kind) {
    case 'studio':
      return r.studyMinutes
    case 'lavoro':
      return r.lavoroMinutes
    case 'abilita':
      return r.abilitaMinutes
    case 'lingua':
      return r.linguaMinutes
    case 'lettura':
      return r.letturaMinutes
    case 'peso':
      return undefined
    default:
      return modules.sport.types[kind].minutes
  }
}

interface QuickLogProps {
  open: boolean
  onClose: () => void
  courses: Course[]
}

/** Il pannello "Registra" di Oggi (SPEC §3.1). */
export function QuickLog({ open, onClose, courses }: QuickLogProps) {
  const { t, f } = useI18n()
  const tq = t.quicklog
  const modules = useModules() ?? DEFAULT_MODULES
  const tuning = useTuning()
  const kinds = useMemo(() => quickLogKinds(modules), [modules])
  const labelOf = (k: Kind) => (k === 'abilita' || k === 'lingua' ? moduleLabel(modules, k, t) : tq.kind[k])
  const today = todayISO()
  const [kind, setKind] = useState<Kind>('studio')
  const [minutes, setMinutes] = useState(() => String(tuning.registra.studyMinutes))
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

  // Se il tipo scelto non c'è più (modulo spento), si torna allo studio.
  useEffect(() => {
    if (!kinds.includes(kind)) {
      setKind('studio')
      setMinutes(String(tuning.registra.studyMinutes))
    }
  }, [kinds, kind, tuning])

  const pick = (next: Kind) => {
    setKind(next)
    const preset = presetMinutes(next, tuning, modules)
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
        } else if (kind === 'lingua') {
          const s = score.trim() ? Number(score.replace(',', '.')) : undefined
          if (s !== undefined && !(s >= 0 && s <= 100)) return setError(tq.errScore)
          await logSession({ date, type: 'lingua', minutes: m, score: s, notes: modules.lingua.appName })
        } else {
          await logSession({ date, type: kind as SessionType, minutes: m, courseId: kind === 'studio' ? courseId || undefined : undefined })
        }
        const named = kind === 'abilita' || kind === 'lingua'
        toast(tq.logged({ minutes: m, label: named ? labelOf(kind) : labelOf(kind).toLowerCase() }, f))
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
          {kinds.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className="chip" onClick={() => pick(k)}>
              {labelOf(k)}
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
          {kind === 'lingua' ? (
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
