import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '../../app/toast'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { remove, save } from '../../db/repo'
import { useModules } from '../../db/hooks'
import type { CalendarEvent, Course, EventType } from '../../db/schema'
import { eventTypeEnabled } from '../../modules/registry'
import { DEFAULT_MODULES } from '../../modules/types'
import { useI18n } from '../../i18n/store'
import { toHHMM, toMinutes, toTimeInput, type ISODate } from '../../lib/dates'

export const EVENT_TYPES: EventType[] = ['lezione', 'studio', 'lavoro', 'sport', 'esame', 'altro']

export type EventDraft = Partial<CalendarEvent> & { date: ISODate }

interface EventSheetProps {
  draft: EventDraft | null
  courses: Course[]
  onClose: () => void
}

export function EventSheet({ draft, courses, onClose }: EventSheetProps) {
  const { t, f } = useI18n()
  const ta = t.agenda
  const modules = useModules() ?? DEFAULT_MODULES
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [type, setType] = useState<EventType>('lezione')
  const [courseId, setCourseId] = useState('')
  const [error, setError] = useState('')
  const editing = !!draft?.id

  useEffect(() => {
    if (!draft) return
    setTitle(draft.title ?? '')
    setDate(draft.date)
    setStart(toTimeInput(draft.start ?? '9:00'))
    setEnd(toTimeInput(draft.end ?? '10:00'))
    setType(draft.type ?? 'lezione')
    setCourseId(draft.courseId ?? '')
    setError('')
  }, [draft])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft) return
    const s = toMinutes(start)
    const en = toMinutes(end)
    if (!title.trim()) return setError(ta.sheet.errTitle)
    if (en <= s) return setError(ta.sheet.errEnd)
    await save<CalendarEvent>(db.events, {
      ...draft,
      id: draft.id,
      date,
      start: toHHMM(s),
      end: toHHMM(en),
      title: title.trim(),
      type,
      courseId: courseId || undefined,
      suggested: draft.suggested ?? false,
      confirmed: true,
    })
    toast(editing ? ta.sheet.updated : ta.sheet.added({ date }, f))
    onClose()
  }

  const del = async () => {
    if (!draft?.id) return
    await remove(db.events, draft.id)
    toast(ta.sheet.removed)
    onClose()
  }

  return (
    <Sheet open={!!draft} title={editing ? ta.sheet.edit : ta.newEvent} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label className="form-field">
          <span>{ta.sheet.title}</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ta.sheet.titlePlaceholder} autoFocus />
        </label>
        <div className="choices" role="radiogroup" aria-label={ta.sheet.type}>
          {EVENT_TYPES.filter((id) => id === type || eventTypeEnabled(modules, id)).map((id) => (
            <button key={id} type="button" role="radio" aria-checked={type === id} className="chip" onClick={() => setType(id)}>
              {ta.eventType[id]}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>{ta.sheet.day}</span>
            <input className="field" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>{ta.sheet.start}</span>
            <input className="field" type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>{ta.sheet.end}</span>
            <input className="field" type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </label>
          {type === 'lezione' || type === 'studio' || type === 'esame' ? (
            <label className="form-field form-field--wide">
              <span>{ta.sheet.course}</span>
              <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">{ta.sheet.noCourse}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <p className="form-error" role="alert">
          {error}
        </p>
        <div className="sheet-actions">
          {editing ? (
            <button type="button" className="btn btn--danger" onClick={() => void del()}>
              {ta.sheet.delete}
            </button>
          ) : null}
          <span className="sheet-actions__spacer" />
          <button type="button" className="btn" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? ta.sheet.save : ta.add}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
