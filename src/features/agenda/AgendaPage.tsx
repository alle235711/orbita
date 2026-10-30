import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Page } from '../../app/Page'
import { navigate, useRoute } from '../../app/router'
import { toast } from '../../app/toast'
import { useMinuteClock, useToday } from '../../app/useToday'
import { SpiralGalaxy } from '../../art/SpiralGalaxy'
import { db } from '../../db/db'
import { useCourses, useModules, useTuning } from '../../db/hooks'
import { useDayPlan } from '../../db/plan-context'
import { alive, patch, remove, save } from '../../db/repo'
import type { CalendarEvent, EventType, Task } from '../../db/schema'
import { addDays, isISODate, todayISO, toMinutes, weekday, weekDays, type ISODate } from '../../lib/dates'
import { renderMsg } from '../../i18n/messages'
import { useI18n } from '../../i18n/store'
import { workSessionTypes } from '../../modules/registry'
import { DEFAULT_MODULES } from '../../modules/types'
import { scheduleDay, type SuggestedBlock } from '../../rules/schedule'
import { hiddenCourseIds, isHiddenLesson, withoutHiddenLessons } from '../../ics/hide'
import { agendaWindow, eventsByDay, layoutDay, weekHours } from './agenda'
import { EventSheet, type EventDraft } from './EventSheet'
import { IcsImportSheet } from './IcsImportSheet'
import './AgendaPage.css'

type View = 'giorno' | 'settimana'

/** Un blocco occupa almeno questo tempo: tanto serve a una riga di testo senza toccare il blocco dopo. */
const MIN_BLOCK_MINUTES = 35
const MIN_WEEK_BLOCK_MINUTES = 45
/** Sotto questa durata il blocco ha una riga sola (titolo e ora); sotto TINY_MINUTES solo il titolo. */
const SHORT_MINUTES = 75
const TINY_MINUTES = 30
const spanOf = (start: string, end: string) => toMinutes(end) - toMinutes(start)

const blockType = (b: SuggestedBlock): EventType =>
  ['arrampicata', 'corsa', 'palestra', 'camminata'].includes(b.item.kind) ? 'sport' : 'studio'

export default function AgendaPage() {
  const i18n = useI18n()
  const { t, f } = i18n
  const ta = t.agenda
  const route = useRoute()
  const today = useToday()
  const now = useMinuteClock()
  const day = isISODate(route.query.get('giorno') ?? '') ? route.query.get('giorno')! : today
  const view: View = route.query.get('vista') === 'settimana' ? 'settimana' : 'giorno'
  const week = useMemo(() => weekDays(day), [day])
  const courses = useCourses()
  const plan = useDayPlan(today)
  const tuning = useTuning()
  const modules = useModules() ?? DEFAULT_MODULES
  const span = agendaWindow(tuning)
  const [draft, setDraft] = useState<EventDraft | null>(null)
  const [icsOpen, setIcsOpen] = useState(false)

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

  // Le lezioni dei corsi con "Nascondi le lezioni" restano nel database ma non si vedono né pesano sulle ore.
  const visible = useMemo(() => withoutHiddenLessons(data?.events ?? [], courses), [data, courses])
  const hiddenToday = useMemo(() => {
    const hidden = hiddenCourseIds(courses)
    return (data?.events ?? []).filter((e) => e.date === day && isHiddenLesson(e, hidden)).length
  }, [data, courses, day])
  const byDay = useMemo(() => eventsByDay(visible, week), [visible, week])
  const hours = useMemo(() => weekHours(day, today, data?.sessions ?? [], visible, workSessionTypes(modules)), [day, today, data, visible, modules])
  const suggestions = useMemo(
    () => (plan ? scheduleDay(plan.plan.items, plan.context.events, { from: plan.now, tuning }) : []),
    [plan, tuning],
  )

  const confirm = async (b: SuggestedBlock) => {
    const title = renderMsg(b.item.title, i18n)
    await save<CalendarEvent>(db.events, {
      date: today,
      start: b.start,
      end: b.end,
      title,
      type: blockType(b),
      courseId: b.item.courseId,
      suggested: true,
      confirmed: true,
      planKey: b.key,
    })
    toast(ta.confirmed({ title, start: b.start, end: b.end }))
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
          {ta.title}
        </h1>
        <p className="page__lead">
          {view === 'giorno' ? ta.dayLead({ date: day, isToday: day === today }, f) : ta.weekLead({ from: week[0]!, to: week[6]! }, f)}
        </p>
        <div className="agenda__tools">
          <div className="segmented" role="group" aria-label={ta.view}>
            <button type="button" className="segmented__item" aria-pressed={view === 'giorno'} onClick={() => go({ vista: 'giorno' })}>
              {ta.viewDay}
            </button>
            <button type="button" className="segmented__item" aria-pressed={view === 'settimana'} onClick={() => go({ vista: 'settimana' })}>
              {ta.viewWeek}
            </button>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => setDraft({ date: day, start: '9:00', end: '10:00' })}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {ta.newEvent}
          </button>
          <button type="button" className="btn" onClick={() => setIcsOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1.5" y="2.5" width="11" height="10" rx="2" />
              <path d="M1.5 5.5h11M4.5 1v3M9.5 1v3M7 7.2v3.1M5.6 8.9L7 10.3l1.4-1.4" />
            </svg>
            {ta.ics.open}
          </button>
        </div>
      </header>

      <nav className="days" aria-label={ta.daysNav}>
        <button type="button" className="days__step" onClick={() => go({ giorno: addDays(day, -7) })} aria-label={ta.prevWeek}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {view === 'settimana' ? <span className="days__label">{ta.weekRange({ from: week[0]!, to: week[6]! }, f)}</span> : null}
        <ol className="days__list" role="list" hidden={view === 'settimana'}>
          {week.map((d) => (
            <li key={d}>
              <button
                type="button"
                className="days__day"
                aria-current={d === day && view === 'giorno' ? 'date' : undefined}
                aria-label={ta.dayLead({ date: d, isToday: d === today }, f)}
                onClick={() => go({ giorno: d, vista: 'giorno' })}
              >
                <span className="days__name">{f.weekdayShort(weekday(d))}</span>
                <span className="days__num">{Number(d.slice(8))}</span>
                {d === today ? <span className="days__today" aria-hidden="true" /> : null}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="days__step" onClick={() => go({ giorno: addDays(day, 7) })} aria-label={ta.nextWeek}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {day !== today ? (
          <button type="button" className="btn days__back" onClick={() => go({ giorno: today })}>
            {ta.today}
          </button>
        ) : null}
      </nav>

      {view === 'giorno' ? (
        <div className="agenda__main">
          <DayTimeline
            span={span}
            day={day}
            events={byDay.get(day) ?? []}
            hiddenCount={hiddenToday}
            suggestions={day === today ? suggestions : []}
            now={day === today ? now : null}
            onEdit={(e) => setDraft(e)}
            onNew={(start) => setDraft({ date: day, start, end: `${Number(start.split(':')[0]) + 1}:${start.split(':')[1]}` })}
            onConfirm={(b) => void confirm(b)}
          />
          <TodoList day={day} today={today} tasks={data?.tasks ?? []} />
        </div>
      ) : (
        <WeekGrid span={span} week={week} today={today} byDay={byDay} onOpen={(d) => go({ giorno: d, vista: 'giorno' })} onEdit={(e) => setDraft(e)} />
      )}

      <EventSheet draft={draft} courses={courses} onClose={() => setDraft(null)} />
      <IcsImportSheet open={icsOpen} onClose={() => setIcsOpen(false)} />
    </Page>
  )
}

// ——— giornata ———

interface DayTimelineProps {
  span: { start: number; end: number }
  day: ISODate
  events: CalendarEvent[]
  hiddenCount: number
  suggestions: SuggestedBlock[]
  now: number | null
  onEdit: (e: CalendarEvent) => void
  onNew: (start: string) => void
  onConfirm: (b: SuggestedBlock) => void
}

function DayTimeline({ day, events, hiddenCount, suggestions, now, span, onEdit, onNew, onConfirm }: DayTimelineProps) {
  const i18n = useI18n()
  const { t, f } = i18n
  const ta = t.agenda
  type Item = { kind: 'event'; event: CalendarEvent; start: string; end: string } | { kind: 'suggestion'; block: SuggestedBlock; start: string; end: string }
  const items: Item[] = [
    ...events.map((event): Item => ({ kind: 'event', event, start: event.start, end: event.end })),
    ...suggestions.map((block): Item => ({ kind: 'suggestion', block, start: block.start, end: block.end })),
  ]
  const from = Math.min(span.start, ...items.map((i) => Math.floor(toMinutes(i.start) / 60) * 60))
  const to = Math.max(span.end, ...items.map((i) => Math.ceil(toMinutes(i.end) / 60) * 60))
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i)
  const placed = layoutDay(items, MIN_BLOCK_MINUTES)
  const pos = (start: number, end: number): CSSProperties => ({
    top: `calc(${(start - from) / 60} * var(--hour))`,
    height: `calc(${(end - start) / 60} * var(--hour) - 4px)`,
  })

  return (
    <section className="timeline" aria-labelledby="h-giornata" style={{ ['--rows' as string]: hours.length }}>
      <h2 id="h-giornata" className="sr-only">
        {ta.eventsOf({ date: day }, f)}
      </h2>
      <div className="timeline__grid">
        {hours.map((h) => (
          <button key={h} type="button" className="timeline__hour" onClick={() => onNew(`${h}:00`)} aria-label={ta.newAt({ hour: h })}>
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
            const real = p.item.kind === 'event' ? spanOf(p.item.event.start, p.item.event.end) : spanOf(p.item.block.start, p.item.block.end)
            const short = real < SHORT_MINUTES
            const tiny = real < TINY_MINUTES
            if (p.item.kind === 'event') {
              const e = p.item.event
              return (
                <li key={e.id} className={`block block--${e.type}${short ? ' block--short' : ''}${tiny ? ' block--tiny' : ''}`} style={style}>
                  <button type="button" className="block__button" onClick={() => onEdit(e)}>
                    <span className="block__title">{e.title}</span>
                    <span className="block__meta">
                      {ta.eventMeta({ start: e.start, end: e.end, type: e.type })}
                    </span>
                  </button>
                </li>
              )
            }
            const b = p.item.block
            const bTitle = renderMsg(b.item.title, i18n)
            return (
              <li key={b.key} className={`block block--suggested${short ? ' block--short' : ''}${tiny ? ' block--tiny' : ''}`} style={style}>
                <button type="button" className="block__button" onClick={() => onConfirm(b)} aria-label={ta.suggestedAria({ title: bTitle, start: b.start, end: b.end })}>
                  <span className="block__title">
                    {bTitle}
                    {b.parts > 1 ? ta.partOf({ part: b.part, parts: b.parts }) : ''}
                  </span>
                  <span className="block__meta">
                    {ta.suggestedMeta({ start: b.start, end: b.end })}
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
      {!events.length && !suggestions.length ? <p className="timeline__empty">{ta.empty}</p> : null}
      {hiddenCount ? <p className="timeline__hidden">{ta.ics.hiddenLessons({ count: hiddenCount }, f)}</p> : null}
    </section>
  )
}

// ——— attività ———

function TodoList({ day, today, tasks }: { day: ISODate; today: ISODate; tasks: Task[] }) {
  const { t: dict, f } = useI18n()
  const ta = dict.agenda
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
      <h2 id="h-todo">{isToday ? ta.todoToday : ta.todoOn({ date: day }, f)}</h2>
      <TaskItems tasks={dueList} day={day} empty={ta.noDue} />
      <h2>{ta.undated}</h2>
      <TaskItems tasks={undated} day={day} empty={ta.noUndated} />
      <form className="todo__add" onSubmit={(e) => void add(e)}>
        <label className="sr-only" htmlFor="new-task">
          {ta.newTask}
        </label>
        <input id="new-task" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ta.taskPlaceholder} />
        <button type="button" className="chip" aria-pressed={dated} onClick={() => setDated((v) => !v)}>
          {dated ? (isToday ? ta.forToday : ta.forDay({ date: day }, f)) : ta.undated}
        </button>
        <button type="submit" className="btn">
          {ta.add}
        </button>
      </form>
    </section>
  )
}

function TaskItems({ tasks, day, empty }: { tasks: Task[]; day: ISODate; empty: string }) {
  const { t: dict, f } = useI18n()
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
            {t.due && t.due < day && !t.done ? <span className="task__late">{dict.agenda.since({ date: t.due }, f)}</span> : null}
          </label>
          <button type="button" className="task__remove" onClick={() => void remove(db.tasks, t.id)} aria-label={dict.agenda.removeTask({ title: t.title })}>
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
  span: { start: number; end: number }
  week: ISODate[]
  today: ISODate
  byDay: Map<ISODate, CalendarEvent[]>
  onOpen: (d: ISODate) => void
  onEdit: (e: CalendarEvent) => void
}

function WeekGrid({ week, today, byDay, span, onOpen, onEdit }: WeekGridProps) {
  const { t, f } = useI18n()
  const all = week.flatMap((d) => byDay.get(d) ?? [])
  const from = Math.min(span.start, ...all.map((e) => Math.floor(toMinutes(e.start) / 60) * 60))
  const to = Math.max(span.end, ...all.map((e) => Math.ceil(toMinutes(e.end) / 60) * 60))
  const hours = Array.from({ length: (to - from) / 60 }, (_, i) => from / 60 + i)
  return (
    <section className="week" aria-label={t.agenda.viewWeek} style={{ ['--rows' as string]: hours.length }}>
      <div className="week__hours" aria-hidden="true">
        {hours.map((h) => (
          <span key={h}>
            {h}
          </span>
        ))}
      </div>
      {week.map((d) => (
        <div key={d} className={`week__day${d === today ? ' week__day--today' : ''}`}>
          <button type="button" className="week__head" onClick={() => onOpen(d)} aria-label={t.agenda.openDay({ date: d }, f)}>
            <span>{f.weekdayShort(weekday(d))}</span>
            <strong>{Number(d.slice(8))}</strong>
          </button>
          <ul className="week__items" role="list" aria-label={t.agenda.dayLead({ date: d, isToday: false }, f)}>
            {(byDay.get(d) ?? []).length === 0 ? <li className="week__none">{t.agenda.free}</li> : null}
            {layoutDay(byDay.get(d) ?? [], MIN_WEEK_BLOCK_MINUTES).map((p) => (
              <li
                key={p.item.id}
                className={`block block--${p.item.type} block--mini${spanOf(p.item.start, p.item.end) < 60 ? ' block--short' : ''}`}
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
