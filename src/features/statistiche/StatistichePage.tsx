import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type FormEvent } from 'react'
import { Page } from '../../app/Page'
import { navigate, useRoute } from '../../app/router'
import { toast } from '../../app/toast'
import { useToday } from '../../app/useToday'
import { DiskGlyph } from '../../art/BlackHole'
import { DeepField } from '../../art/DeepField'
import { StatsChalk } from '../../art/StatsChalk'
import { logWeight } from '../../db/actions'
import { db } from '../../db/db'
import { useCourses } from '../../db/hooks'
import { useDayPlan } from '../../db/plan-context'
import { alive } from '../../db/repo'
import { useI18n } from '../../i18n/store'
import { ENERGY } from '../../lib/energy'
import {
  averageFor,
  dailyHours,
  elsaDays,
  energyVsHours,
  hoursBySubject,
  kpis,
  periodRange,
  typingDays,
  weightTrend,
  workoutRows,
  type Period,
} from '../../stats/aggregate'
import { Bars, Columns, DataTable, LineChart, Lollipops, Strips } from './charts'
import './StatistichePage.css'

const PERIODS: Period[] = ['7', '14', 'settembre']

export default function StatistichePage() {
  const { t, f } = useI18n()
  const ts = t.stats
  const hours = (n: number) => ts.hours({ n }, f)
  const num = (n: number, digits?: number) => f.number(n, digits)
  const route = useRoute()
  const today = useToday()
  const courses = useCourses()
  const state = useDayPlan(today)
  const period = (PERIODS.find((p) => p === route.query.get('periodo')) ?? '14') as Period
  const range = useMemo(() => periodRange(period, today), [period, today])
  const since = periodRange('settembre', today).from
  const [kg, setKg] = useState('')

  const data = useLiveQuery(async () => {
    const [sessions, workouts, weights, runs, days] = await Promise.all([
      db.sessions.where('date').between(since, today, true, true).toArray(),
      db.workouts.where('date').between(since, today, true, true).toArray(),
      db.weights.where('date').between(since, today, true, true).toArray(),
      db.typingRuns.where('date').between(since, today, true, true).toArray(),
      db.days.toArray(),
    ])
    return { sessions: alive(sessions), workouts: alive(workouts), weights: alive(weights), runs: alive(runs), days: alive(days) }
  }, [since, today])

  const view = useMemo(() => {
    if (!data || !state) return null
    const target = state.plan.hours.hoursPerDay
    const daily = dailyHours(data.sessions, range.days)
    return {
      target,
      daily,
      subjects: hoursBySubject(data.sessions, courses, range, (ty) => ts.typeLabel[ty]),
      workouts: workoutRows(data.workouts, range),
      weight: weightTrend(data.weights, range),
      typing: typingDays(data.runs, range),
      elsa: elsaDays(data.sessions, range.days),
      energy: energyVsHours(data.days, data.sessions, range),
      kpi: kpis(data.sessions, data.workouts, data.runs, range, today, target, state.plan.sport.mainTarget),
      overTarget: daily.filter((d) => d.total >= target).length,
    }
  }, [data, state, range, courses, today, ts])

  const addWeight = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(kg.replace(',', '.'))
    if (!(value > 20 && value < 300)) return toast(t.quicklog.errWeight, 'error')
    await logWeight(today, Math.round(value * 10) / 10)
    setKg('')
    toast(t.quicklog.weightLogged({ kg: value }, f))
  }

  if (!view || !state) return <Page className="stats" />
  const { kpi } = view
  const high = averageFor(view.energy, [4, 5])
  const low = averageFor(view.energy, [1, 2])
  const priority = state.plan.priority?.courseId

  return (
    <Page className="stats" labelledBy="titolo-stats">
      <DeepField className="stats__field" />
      <StatsChalk className="stats__chalk" />

      <header className="stats__head">
        <div>
          <h1 id="titolo-stats" className="page__title">
            {ts.title}
          </h1>
          <p className="page__lead">
            {range.days.length === 1 ? ts.rangeOne({ date: range.from }, f) : ts.rangeMany({ from: range.from, to: range.to }, f)}
          </p>
        </div>
        <div className="segmented" role="group" aria-label={ts.period}>
          {PERIODS.map((p) => (
            <button key={p} type="button" className="segmented__item" aria-pressed={p === period} onClick={() => navigate('statistiche', { periodo: p })}>
              {ts.periods[p]}
            </button>
          ))}
        </div>
      </header>

      <dl className="kpis">
        <div>
          <dt>{ts.kpiLast7}</dt>
          <dd>
            {num(kpi.hours7)}
            <span>{ts.kpiHoursOf({ target: kpi.target7 }, f)}</span>
          </dd>
        </div>
        <div>
          <dt>{ts.kpiAverage}</dt>
          <dd>
            {num(kpi.averagePerDay)}
            <span>{ts.hUnit}</span>
          </dd>
        </div>
        <div>
          <dt>{ts.kpiClimbs({ month: today.slice(0, 7) }, f)}</dt>
          <dd>
            {kpi.climbsMonth}
            <span>{ts.kpiClimbsOf({ target: kpi.climbsMonthTarget })}</span>
          </dd>
        </div>
        <div>
          <dt>{ts.kpiTyping}</dt>
          <dd>
            {kpi.lastWpm ?? '–'}
            <span>{ts.wpmShort}</span>
          </dd>
        </div>
      </dl>

      <div className="stats__grid">
        <section className="panel panel--wide" aria-labelledby="h-giorni">
          <div className="panel__head">
            <h2 id="h-giorni">{ts.hoursPerDay}</h2>
            <p>
              {ts.hoursNote({ target: view.target, over: view.overTarget, days: view.daily.length }, f)}
            </p>
          </div>
          <Lollipops
            today={today}
            target={view.target}
            data={view.daily.map((d) => ({
              date: d.date,
              value: d.total,
              title: ts.lollipopTitle({ date: d.date, total: d.total, study: d.study, work: d.work }, f),
            }))}
          />
          <DataTable
            caption={ts.hoursPerDay}
            head={[ts.colDay, ts.colStudy, ts.colWork, ts.colTotal]}
            rows={view.daily.map((d) => [f.dateShort(d.date), num(d.study), num(d.work), num(d.total)])}
          />
        </section>

        <section className="panel panel--side" aria-labelledby="h-materie">
          <div className="panel__head">
            <h2 id="h-materie">{ts.whereHours}</h2>
          </div>
          {view.subjects.length ? (
            <Bars
              data={view.subjects.slice(0, 8).map((s) => ({ id: s.id, label: s.label, value: s.hours, display: hours(s.hours), highlight: s.courseId === priority }))}
            />
          ) : (
            <p className="chart__empty">{ts.noSessions}</p>
          )}
          {priority ? <p className="panel__note">{ts.priorityNote}</p> : null}
        </section>

        <section className="panel panel--third" aria-labelledby="h-sport">
          <div className="panel__head">
            <h2 id="h-sport">{ts.sportTitle}</h2>
          </div>
          <Strips
            days={range.days}
            rows={view.workouts.map((w) => ({
              id: w.type,
              label: t.sport.label[w.type],
              dates: w.dates,
              summary: `${w.count}`,
            }))}
          />
          <DataTable
            caption={ts.workoutsCaption}
            head={[ts.colType, ts.colSessions, ts.colHours]}
            rows={view.workouts.map((w) => [t.sport.label[w.type], String(w.count), num(w.minutes / 60)])}
          />
        </section>

        <section className="panel panel--third" aria-labelledby="h-peso">
          <div className="panel__head">
            <h2 id="h-peso">{ts.weight}</h2>
            <p>
              {view.weight.last ? ts.weightLast({ kg: view.weight.last.kg, date: view.weight.last.date }, f) : ts.weightNone}
              {view.weight.perWeek !== undefined ? ts.weightPerWeek({ value: view.weight.perWeek }, f) : ''}.
            </p>
          </div>
          <LineChart
            points={view.weight.points.map((p) => ({ date: p.date, value: p.kg, title: ts.weightPoint({ date: p.date, kg: p.kg }, f) }))}
            days={range.days}
            format={(v) => ts.kg({ v }, f)}
            label={ts.weightChart}
            minSpan={2}
          />
          <form className="weight-form" onSubmit={(e) => void addWeight(e)}>
            <label className="sr-only" htmlFor="kg">
              {ts.weightFieldLabel}
            </label>
            <input id="kg" className="field" inputMode="decimal" placeholder={ts.weightPlaceholder} value={kg} onChange={(e) => setKg(e.target.value)} />
            <button type="submit" className="btn">
              {ts.register}
            </button>
          </form>
        </section>

        <section className="panel panel--third" aria-labelledby="h-energia">
          <div className="panel__head">
            <h2 id="h-energia">{ts.energy}</h2>
            <p>
              {high !== undefined && low !== undefined ? ts.energyNote({ high, low }, f) : ts.energyHint}
            </p>
          </div>
          <ul className="energy-rows" role="list">
            {view.energy.map((r) => (
              <li key={r.energy}>
                <DiskGlyph level={r.energy} color={ENERGY[r.energy].color} />
                <span className="energy-rows__name">{ENERGY[r.energy].name}</span>
                <span className="energy-rows__track" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (r.average / 10) * 100)}%`, background: ENERGY[r.energy].color }} />
                </span>
                <span className="energy-rows__value">{r.days ? hours(r.average) : '–'}</span>
              </li>
            ))}
          </ul>
          <DataTable
            caption={ts.energyCaption}
            head={[ts.colState, ts.colDays, ts.colAverage]}
            rows={view.energy.map((r) => [ENERGY[r.energy].name, String(r.days), r.days ? num(r.average) : '–'])}
          />
        </section>

        <section className="panel panel--half" aria-labelledby="h-datti">
          <div className="panel__head">
            <h2 id="h-datti">{ts.typing}</h2>
            <p>{view.typing.length ? ts.typingRuns({ n: view.typing.reduce((n, d) => n + d.runs, 0) }, f) : ts.typingNone}</p>
          </div>
          <div className="pair">
            <div>
              <h3>{ts.wpmTitle}</h3>
              <LineChart
                points={view.typing.map((d) => ({ date: d.date, value: d.wpm, title: ts.wpmPoint({ date: d.date, wpm: d.wpm }, f) }))}
                days={range.days}
                format={(v) => String(Math.round(v))}
                label={ts.wpmChart}
                minSpan={10}
              />
            </div>
            <div>
              <h3>{ts.accuracyTitle}</h3>
              <LineChart
                points={view.typing.map((d) => ({ date: d.date, value: d.accuracy * 100, title: ts.accuracyPoint({ date: d.date, accuracy: d.accuracy }, f) }))}
                days={range.days}
                format={(v) => `${Math.round(v)}%`}
                label={ts.accuracyChart}
                minSpan={10}
              />
            </div>
          </div>
        </section>

        <section className="panel panel--half" aria-labelledby="h-elsa">
          <div className="panel__head">
            <h2 id="h-elsa">{ts.english}</h2>
            <p>{ts.englishMinutes({ n: view.elsa.reduce((n, d) => n + d.minutes, 0) }, f)}</p>
          </div>
          <div className="pair">
            <div>
              <h3>{ts.minutesPerDay}</h3>
              <Columns
                data={view.elsa.map((d) => ({ date: d.date, value: d.minutes, title: ts.minutesPoint({ date: d.date, n: d.minutes }, f) }))}
                days={range.days}
                format={(v) => ts.minutesFmt({ v })}
                label={ts.englishChart}
              />
            </div>
            <div>
              <h3>{ts.score}</h3>
              <LineChart
                points={view.elsa.filter((d) => d.score !== undefined).map((d) => ({ date: d.date, value: d.score!, title: ts.scorePoint({ date: d.date, score: d.score! }, f) }))}
                days={range.days}
                format={(v) => String(Math.round(v))}
                label={ts.scoreChart}
                minSpan={10}
              />
            </div>
          </div>
        </section>

        <section className="panel panel--future" aria-labelledby="h-orologio">
          <h2 id="h-orologio">{ts.watch}</h2>
          <p>{ts.watchFuture}</p>
        </section>
      </div>
    </Page>
  )
}
