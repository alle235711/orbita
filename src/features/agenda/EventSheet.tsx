import { useEffect, useState, type FormEvent } from 'react'
import { toast } from '../../app/toast'
import { Sheet } from '../../components/Sheet'
import { db } from '../../db/db'
import { remove, save } from '../../db/repo'
import type { CalendarEvent, Course, EventType } from '../../db/schema'
import { formatDate, toHHMM, toMinutes, toTimeInput, type ISODate } from '../../lib/dates'

export const EVENT_TYPES: { id: EventType; label: string }[] = [
  { id: 'lezione', label: 'Lezione' },
  { id: 'studio', label: 'Studio' },
  { id: 'lavoro', label: 'Lavoro' },
  { id: 'sport', label: 'Sport' },
  { id: 'esame', label: 'Esame' },
  { id: 'altro', label: 'Altro' },
]

export type EventDraft = Partial<CalendarEvent> & { date: ISODate }

interface EventSheetProps {
  draft: EventDraft | null
  courses: Course[]
  onClose: () => void
}

export function EventSheet({ draft, courses, onClose }: EventSheetProps) {
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
    if (!title.trim()) return setError('Dai un titolo all’impegno.')
    if (en <= s) return setError('La fine deve venire dopo l’inizio.')
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
    toast(editing ? 'Impegno aggiornato.' : `Impegno aggiunto il ${formatDate(date)}.`)
    onClose()
  }

  const del = async () => {
    if (!draft?.id) return
    await remove(db.events, draft.id)
    toast('Impegno tolto dall’agenda.')
    onClose()
  }

  return (
    <Sheet open={!!draft} title={editing ? 'Modifica impegno' : 'Nuovo impegno'} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        <label className="form-field">
          <span>Titolo</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Topologia Algebrica" autoFocus />
        </label>
        <div className="choices" role="radiogroup" aria-label="Tipo">
          {EVENT_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={type === t.id} className="chip" onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <label className="form-field form-field--wide">
            <span>Giorno</span>
            <input className="field" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Inizio</span>
            <input className="field" type="time" step={300} value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>Fine</span>
            <input className="field" type="time" step={300} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </label>
          {type === 'lezione' || type === 'studio' || type === 'esame' ? (
            <label className="form-field form-field--wide">
              <span>Corso</span>
              <select className="field" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Nessuno</option>
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
              Elimina
            </button>
          ) : null}
          <span className="sheet-actions__spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Annulla
          </button>
          <button type="submit" className="btn btn--primary">
            {editing ? 'Salva' : 'Aggiungi'}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
