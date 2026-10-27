import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Page } from '../../app/Page'
import { navigate, useRoute } from '../../app/router'
import { toast } from '../../app/toast'
import { useMinuteClock, useToday } from '../../app/useToday'
import { SpiralGalaxy } from '../../art/SpiralGalaxy'
import { db } from '../../db/db'
import { useCourses } from '../../db/hooks'
import { useDayPlan } from '../../db/plan-context'
import { alive, patch, remove, save } from '../../db/repo'
import type { CalendarEvent, EventType, Task } from '../../db/schema'
import { addDays, capitalize, formatDate, formatLong, formatShort, isISODate, todayISO, toMinutes, weekDays, weekdayShort, type ISODate } from '../../lib/dates'
import { scheduleDay, type SuggestedBlock } from '../../rules/schedule'
import { AGENDA_END, AGENDA_START, eventsByDay, layoutDay, weekHours } from './agenda'
import { EVENT_TYPES, EventSheet, type EventDraft } from './EventSheet'
import './AgendaPage.css'

type View = 'giorno' | 'settimana'

const TYPE_LABEL = Object.fromEntries(EVENT_TYPES.map((t) => [t.id, t.label.toLowerCase()])) as Record<EventType, string>

const blockType = (b: SuggestedBlock): EventType =>
  ['arrampicata', 'corsa', 'palestra', 'camminata'].includes(b.item.kind) ? 'sport' : 'studio'

export default function AgendaPage() {
  const route = useRoute()
  const today = useToday()
  const now = useMinuteClock()
  const day = isISODate(route.query.get('giorno') ?? '') ? route.query.get('giorno')! : today
  const view: View = route.query.get('vista') === 'settimana' ? 'settimana' : 'giorno'
  const week = useMemo(() => weekDays(day), [day])
  const courses = useCourses()
  const plan = useDayPlan(today)
  const [draft, setDraft] = useState<EventDraft | null>(null)

  const data = useLiveQuery(async () => {
    const [events, sessions, tasks] = await Promise.all([
      db.events.where('date').between(week[0]!, week[6]!, true, true).toArray(),
      db.sessions.where('date').between(week[0]!, week[6]!, true, true).toArray(),
      db.tasks.toArray(),
    ])
    return { events: alive(events), sessions: alive(sessions), tasks: alive(tasks) }
  }, [week[0]])

  const go = (next: { giorno?: ISODate; vista?: View }) =>
    navigate('agenda', { giorno: next.giorno ?? day, ...(next.vista ?? view) === 'settimana' ? { vista: 'settimana' } : {} })

  const byDay = useMemo(() => eventsByDay(data?.events ?? [], week), [data, week])
  const hours = useMemo(() => weekHours(day, today, data?.sessions ?? [], data?.events ?? []), [day, today, data])
  const suggestions = useMemo(
    () => (plan ? scheduleDay(plan.plan.items, plan.context.events, { from: plan.now }) : []),
    [plan],
  )

  const confirm = async (b: SuggestedBlock) => {
    await save<CalendarEvent>(db.events, {
      date: today,
      start: b.start,
      end: b.end,
      title: b.title,
      type: blockType(b),
      courseId: b.item.courseId,
      suggested: true,
      confirmed: true,
      planKey: b.key,
    })
    toast(`In agenda: ${b.title}, ${b.start}–${b.end}.`)
  }

  const todayIndex = week.indexOf(today)
  const selectedIndex = week.indexOf(day)

  return (
    <Page className="agenda" labelledBy="titolo-agenda">
      <SpiralGalaxy
        className={`agenda__galaxy agenda__galaxy--${view}`}
        hours={hours}
        todayIndex={todayIndex}
        selectedIndex={selectedIndex}
        onSelect={(i) => go({ giorno: week[i]!, vista: 'giorno' })}
      />

      <header className="agenda__head">
        <h1 id="titolo-agenda" className="page__title">
          Agenda
        </h1>
        <p className="page__lead">
          {view === 'giorno'
            ? `${capitalize(formatLong(day))}${day === today ? ', oggi' : ''}`
            : `Settimana dal ${formatShort(week[0]!)} al ${formatShort(week[6]!)}`}
        </p>
        <div className="agenda__tools">
          <div className="segmented" role="group" aria-label="Vista">
            <button type="button" className="segmented__item" aria-pressed={view === 'giorno'} onClick={() => go({ vista: 'giorno' })}>
              Giorno
            </button>
            <button type="button" className="segmented__item" aria-pressed={view === 'settimana'} onClick={() => go({ vista: 'settimana' })}>
              Settimana
            </button>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setDraft({ date: day, start: '9:00', end: '10:00' })}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Nuovo impegno
          </button>
        </div>
      </header>

      <nav className="days" aria-label="Giorni della settimana">
        <button type="button" className="days__step" onClick={() => go({ giorno: addDays(day, -7) })} aria-label="Settimana prima">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {view === 'settimana' ? <span className="days__label">{`${formatShort(week[0]!)} – ${formatShort(week[6]!)}`}</span> : null}
        <ol className="days__list" role="list" hidden={view === 'settimana'}>
          {week.map((d) => (
            <li key={d}>
              <button
                type="button"
                className="days__day"
                aria-current={d === day && view === 'giorno' ? 'date' : undefined}
                aria-label={`${capitalize(formatLong(d))}${d === today ? ', oggi' : ''}`}
                onClick={() => go({ giorno: d, vista: 'giorno' })}
              >
                <span className="days__name">{weekdayShort(d)}</span>
                <span className="days__num">{Number(d.slice(8))}</span>
                {d === today ? <span className="days__today" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="days__step" onClick={() => go({ giorno: addDays(day, 7) })} aria-label="Settimana dopo">
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {day !== today ? (
          <button type="button" className="btn days__back" onClick={() => go({ giorno: today })}>
            Oggi
          </button>
        ) : null}
      </nav>

      {view === 'giorno' ? (
        <div className="agenda__main">
          <DayTimeline
            day={day}
            events={byDay.get(day) ?? []}
            suggestions={day === today ? suggestions : []}
            now={day === today ? now : null}
            onEdit={(e) => setDraft(e)}
            onNew={(start) => setDraft({ date: day, start, end: `${Number(start.split(':')[0]) + 1}:${start.split(':')[1]}` })}
            onConfirm={(b) => void confirm(b)}
          />
          <TodoList day={day} today={today} tasks={data?.tasks ?? []} />
        </div>
      ) : (
        <WeekGrid week={week} today={today} byDay={byDay} onOpen={(d) => go({ giorno: d, vista: 'giorno' })} onEdit={(e) => setDraft(e)} />
      )}

      <EventSheet draft={draft} courses={courses} onClose={() => setDraft(null)} />
    </Page>
  )
}

// ——— giornata ———

interface DayTimelineProps {
  day: ISODate
  events: CalendarEvent[]
  suggestions: SuggestedBlock[]
  now: number | null
  onEdit: (e: CalendarEvent) => void
  onNew: (start: string) => void
  onConfirm: (b: SuggestedBlock) => void
}

function DayTimeline({ day, events, suggestions, now, onEdit, onNew, onConfirm }: DayTimelineProps) {
  type Item = { kind: 'event'; event: CalendarEvent; start: string; end: string } | { kind: 'suggestion'; block: SuggestedBlock; start: string; end: string }
  const items: Item[] = [
    ...events.map((event): Item => ({ kind: 'event', event, start: event.start, end: event.end })),
    ...suggestions.map((block): Item => ({ kind: 'suggestion', block, start: block.start, end: block.end })),
  ]
  const from = Math.min(AGENDA_START, ...items.map((i) => Math.floor(toMinutes(i.start) / 60) * 60))
  const to = Math.max(AGENDA_END, ...items.map((i) => Math.ceil(toMinutes(i.end) / 60) * 60))
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i)
  const placed = layoutDay(items)
  const pos = (start: number, end: number): CSSProperties => ({
    top: `calc(${(start - from) / 60} * var(--hour))`,
    height: `calc(${(end - start) / 60} * var(--hour) - 4px)`,
  })

  return (
    <section className="timeline" aria-labelledby="h-giornata" style={{ ['--rows' as string]: hours.length }}>
      <h2 id="h-giornata" className="sr-only">
        Impegni del {formatDate(day)}
      </h2>
      <div className="timeline__grid">
        {hours.map((h) => (
          <button key={h} type="button" className="timeline__hour" onClick={() => onNew(`${h}:00`)} aria-label={`Nuovo impegno alle ${h}:00`}>
            <span>{`${h}:00`}</span>
          </button>
        ))}
        <ul className="timeline__items" role="list">
          {placed.map((p) => {
            const style: CSSProperties = {
              ...pos(p.start, p.end),
              left: `calc(${p.column} / ${p.columns} * 100%)`,
              width: `calc(100% / ${p.columns} - 4px)`,
            }
            const short = p.end - p.start < 50
            const tiny = p.end - p.start < 30
            if (p.item.kind === 'event') {
              const e = p.item.event
              return (
                <li key={e.id} className={`block block--${e.type}${short ? ' block--short' : ''}${tiny ? ' block--tiny' : ''}`} style={style}>
                  <button type="button" className="block__button" onClick={() => onEdit(e)}>
                    <span className="block__title">{e.title}</span>
                    <span className="block__meta">
                      {e.start}–{e.end}, {TYPE_LABEL[e.type]}
                    </span>
                  </button>
                </li>
              )
            }
            const b = p.item.block
            return (
              <li key={b.key} className={`block block--suggested${short ? ' block--short' : ''}${tiny ? ' block--tiny' : ''}`} style={style}>
                <button type="button" className="block__button" onClick={() => onConfirm(b)} aria-label={`${b.title}, ${b.start}–${b.end}. Suggerito dal piano: conferma.`}>
                  <span className="block__title">
                    {b.title}
                    {b.parts > 1 ? `, ${b.part} di ${b.parts}` : ''}
                  </span>
                  <span className="block__meta">
                    {b.start}–{b.end}, suggerito: tocca per confermare
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {now !== null && now >= from && now <= to ? (
          <div className="timeline__now" style={{ top: `calc(${(now - from) / 60} * var(--hour))` }} aria-hidden="true" />
        ) : null}
      </div>
      {!events.length && !suggestions.length ? <p className="timeline__empty">Niente in agenda. Tocca un’ora per aggiungere un impegno.</p> : null}
    </section>
  )
}

// ——— attività ———

function TodoList({ day, today, tasks }: { day: ISODate; today: ISODate; tasks: Task[] }) {
  const [title, setTitle] = useState('')
  const [dated, setDated] = useState(true)
  const isToday = day === today
  // Le non fatte in scadenza entro il giorno (anche in ritardo); le fatte
  // restano visibili il giorno della scadenza o quello in cui le hai chiuse.
  const doneOn = (t: Task) => (t.doneAt ? todayISO(new Date(t.doneAt)) : undefined)
  const order = (a: Task, b: Task) => Number(a.done) - Number(b.done) || (a.due ?? '').localeCompare(b.due ?? '')
  const dueList = tasks.filter((t) => t.due && (t.done ? t.due === day || doneOn(t) === day : t.due <= day)).sort(order)
  const undated = tasks.filter((t) => !t.due && (!t.done || doneOn(t) === day)).sort(order)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await save<Task>(db.tasks, { title: title.trim(), due: dated ? day : undefined, done: false })
    setTitle('')
  }

  return (
    <section className="todo" aria-labelledby="h-todo">
      <h2 id="h-todo">{isToday ? 'Da fare oggi' : `Da fare il ${formatDate(day)}`}</h2>
      <TaskItems tasks={dueList} day={day} empty="Niente in scadenza." />
      <h2>Senza data</h2>
      <TaskItems tasks={undated} day={day} empty="Nessuna attività senza data." />
      <form className="todo__add" onSubmit={(e) => void add(e)}>
        <label className="sr-only" htmlFor="new-task">
          Nuova attività
        </label>
        <input id="new-task" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aggiungi un’attività" />
        <button type="button" className="chip" aria-pressed={dated} onClick={() => setDated((v) => !v)}>
          {dated ? (isToday ? 'Per oggi' : `Per il ${formatShort(day)}`) : 'Senza data'}
        </button>
        <button type="submit" className="btn">
          Aggiungi
        </button>
      </form>
    </section>
  )
}

function TaskItems({ tasks, day, empty }: { tasks: Task[]; day: ISODate; empty: string }) {
  if (!tasks.length) return <p className="todo__empty">{empty}</p>
  return (
    <ul className="todo__list" role="list">
      {tasks.map((t) => (
        <li key={t.id} className={`task${t.done ? ' task--done' : ''}`}>
          <label className="task__label">
            {/* non controllata: si spunta subito, la key la riallinea al database */}
            <input
              key={String(t.done)}
              type="checkbox"
              defaultChecked={t.done}
              onChange={(e) => void patch(db.tasks, t.id, { done: e.target.checked, doneAt: e.target.checked ? Date.now() : undefined })}
            />
            <span>{t.title}</span>
            {t.due && t.due < day && !t.done ? <span className="task__late">dal {formatShort(t.due)}</span> : null}
          </label>
          <button type="button" className="task__remove" onClick={() => void remove(db.tasks, t.id)} aria-label={`Elimina ${t.title}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8.5h4.8l.6-8.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ——— settimana ———

interface WeekGridProps {
  week: ISODate[]
  today: ISODate
  byDay: Map<ISODate, CalendarEvent[]>
  onOpen: (d: ISODate) => void
  onEdit: (e: CalendarEvent) => void
}

function WeekGrid({ week, today, byDay, onOpen, onEdit }: WeekGridProps) {
  const all = week.flatMap((d) => byDay.get(d) ?? [])
  const from = Math.min(AGENDA_START, ...all.map((e) => Math.floor(toMinutes(e.start) / 60) * 60))
  const to = Math.max(AGENDA_END, ...all.map((e) => Math.ceil(toMinutes(e.end) / 60) * 60))
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i)
  return (
    <section className="week" aria-label="Settimana" style={{ ['--rows' as string]: hours.length }}>
      <div className="week__hours" aria-hidden="true">
        {hours.map((h) => (
          <span key={h}>
            {h}
          </span>
        ))}
      </div>
      {week.map((d) => (
        <div key={d} className={`week__day${d === today ? ' week__day--today' : ''}`}>
          <button type="button" className="week__head" onClick={() => onOpen(d)} aria-label={`Apri ${formatLong(d)}`}>
            <span>{weekdayShort(d)}</span>
            <strong>{Number(d.slice(8))}</strong>
          </button>
          <ul className="week__items" role="list" aria-label={capitalize(formatLong(d))}>
            {(byDay.get(d) ?? []).length === 0 ? <li className="week__none">Libero</li> : null}
            {layoutDay(byDay.get(d) ?? []).map((p) => (
              <li
                key={p.item.id}
                className={`block block--${p.item.type} block--mini`}
                style={{
                  top: `calc(${(p.start - from) / 60} * var(--hour))`,
                  height: `calc(${(p.end - p.start) / 60} * var(--hour) - 3px)`,
                  left: `calc(${p.column} / ${p.columns} * 100%)`,
                  width: `calc(100% / ${p.columns} - 3px)`,
                }}
              >
                <button type="button" className="block__button" onClick={() => onEdit(p.item)}>
                  <span className="block__meta">{p.item.start}</span>
                  <span className="block__title">{p.item.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
