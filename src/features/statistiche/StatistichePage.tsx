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
import { formatDate, formatDecimal, formatShort, monthName, withDate } from '../../lib/dates'
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

const PERIODS: { id: Period; label: string }[] = [
  { id: '7', label: '7 giorni' },
  { id: '14', label: '14 giorni' },
  { id: 'settembre', label: 'Da settembre' },
]

const hours = (n: number) => `${formatDecimal(n)} h`
const WORKOUT_LABEL = { arrampicata: 'Arrampicata', corsa: 'Corsa', palestra: 'Palestra' } as const

export default function StatistichePage() {
  const route = useRoute()
  const today = useToday()
  const courses = useCourses()
  const state = useDayPlan(today)
  const period = (PERIODS.find((p) => p.id === route.query.get('periodo'))?.id ?? '14') as Period
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
      subjects: hoursBySubject(data.sessions, courses, range),
      workouts: workoutRows(data.workouts, range),
      weight: weightTrend(data.weights, range),
      typing: typingDays(data.runs, range),
      elsa: elsaDays(data.sessions, range.days),
      energy: energyVsHours(data.days, data.sessions, range),
      kpi: kpis(data.sessions, data.workouts, data.runs, range, today, target, state.plan.sport.mainTarget),
      overTarget: daily.filter((d) => d.total >= target).length,
    }
  }, [data, state, range, courses, today])

  const addWeight = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(kg.replace(',', '.'))
    if (!(value > 20 && value < 300)) return toast('Scrivi il peso in chilogrammi, per esempio 72,5.', 'error')
    await logWeight(today, Math.round(value * 10) / 10)
    setKg('')
    toast(`Registrato il peso: ${value.toLocaleString('it-IT')} kg.`)
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
            Statistiche
          </h1>
          <p className="page__lead">
            {range.days.length === 1 ? withDate('Il', formatDate(range.from)) : `${withDate('Dal', formatDate(range.from))} ${withDate('al', formatDate(range.to))}`}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button key={p.id} type="button" className="segmented__item" aria-pressed={p.id === period} onClick={() => navigate('statistiche', { periodo: p.id })}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <dl className="kpis">
        <div>
          <dt>Ultimi 7 giorni</dt>
          <dd>
            {formatDecimal(kpi.hours7)}
            <span> h su {formatDecimal(kpi.target7)}</span>
          </dd>
        </div>
        <div>
          <dt>Media al giorno nel periodo</dt>
          <dd>
            {formatDecimal(kpi.averagePerDay)}
            <span> h</span>
          </dd>
        </div>
        <div>
          <dt>Arrampicate a {monthName(Number(today.slice(5, 7)))}</dt>
          <dd>
            {kpi.climbsMonth}
            <span> su {kpi.climbsMonthTarget}</span>
          </dd>
        </div>
        <div>
          <dt>Velocità di scrittura</dt>
          <dd>
            {kpi.lastWpm ?? '–'}
            <span> parole/min</span>
          </dd>
        </div>
      </dl>

      <div className="stats__grid">
        <section className="panel panel--wide" aria-labelledby="h-giorni">
          <div className="panel__head">
            <h2 id="h-giorni">Ore al giorno</h2>
            <p>
              Studio e lavoro insieme; sopra le {formatDecimal(view.target)} ore in {view.overTarget} {view.overTarget === 1 ? 'giorno' : 'giorni'} su{' '}
              {view.daily.length}.
            </p>
          </div>
          <Lollipops
            today={today}
            target={view.target}
            data={view.daily.map((d) => ({
              date: d.date,
              value: d.total,
              title: `${formatDate(d.date)}: ${hours(d.total)}${d.work ? ` (studio ${hours(d.study)}, lavoro ${hours(d.work)})` : ''}`,
            }))}
          />
          <DataTable
            caption="Ore al giorno"
            head={['Giorno', 'Studio', 'Lavoro', 'Totale']}
            rows={view.daily.map((d) => [formatShort(d.date), formatDecimal(d.study), formatDecimal(d.work), formatDecimal(d.total)])}
          />
        </section>

        <section className="panel panel--side" aria-labelledby="h-materie">
          <div className="panel__head">
            <h2 id="h-materie">Dove sono andate le ore</h2>
          </div>
          {view.subjects.length ? (
            <Bars
              data={view.subjects.slice(0, 8).map((s) => ({ id: s.id, label: s.label, value: s.hours, display: hours(s.hours), highlight: s.courseId === priority }))}
            />
          ) : (
            <p className="chart__empty">Nessuna sessione nel periodo.</p>
          )}
          {priority ? <p className="panel__note">In evidenza la priorità di oggi.</p> : null}
        </section>

        <section className="panel panel--third" aria-labelledby="h-sport">
          <div className="panel__head">
            <h2 id="h-sport">Arrampicata, corsa e palestra</h2>
          </div>
          <Strips
            days={range.days}
            rows={view.workouts.map((w) => ({
              id: w.type,
              label: WORKOUT_LABEL[w.type],
              dates: w.dates,
              summary: `${w.count}`,
            }))}
          />
          <DataTable
            caption="Allenamenti"
            head={['Tipo', 'Sessioni', 'Ore']}
            rows={view.workouts.map((w) => [WORKOUT_LABEL[w.type], String(w.count), formatDecimal(w.minutes / 60)])}
          />
        </section>

        <section className="panel panel--third" aria-labelledby="h-peso">
          <div className="panel__head">
            <h2 id="h-peso">Peso</h2>
            <p>
              {view.weight.last ? `${formatDecimal(view.weight.last.kg)} kg ${withDate('il', formatShort(view.weight.last.date))}` : 'Nessuna pesata nel periodo'}
              {view.weight.perWeek !== undefined ? `, ${view.weight.perWeek <= 0 ? '' : '+'}${formatDecimal(view.weight.perWeek, 2)} kg a settimana` : ''}.
            </p>
          </div>
          <LineChart
            points={view.weight.points.map((p) => ({ date: p.date, value: p.kg, title: `${formatShort(p.date)}: ${formatDecimal(p.kg)} kg` }))}
            days={range.days}
            format={(v) => `${formatDecimal(v)} kg`}
            label="Andamento del peso nel periodo"
            minSpan={2}
          />
          <form className="weight-form" onSubmit={(e) => void addWeight(e)}>
            <label className="sr-only" htmlFor="kg">
              Peso di oggi in chilogrammi
            </label>
            <input id="kg" className="field" inputMode="decimal" placeholder="Peso di oggi, kg" value={kg} onChange={(e) => setKg(e.target.value)} />
            <button type="submit" className="btn">
              Registra
            </button>
          </form>
        </section>

        <section className="panel panel--third" aria-labelledby="h-energia">
          <div className="panel__head">
            <h2 id="h-energia">Energia e ore</h2>
            <p>
              {high !== undefined && low !== undefined
                ? `Da Quasar e Blazar fai in media ${hours(high)}, da Sgr A* e LINER ${hours(low)}.`
                : 'Scegli l’energia ogni giorno su Oggi: qui vedrai quante ore fai con ogni stato.'}
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
            caption="Ore medie per stato del buco nero"
            head={['Stato', 'Giorni', 'Ore medie']}
            rows={view.energy.map((r) => [ENERGY[r.energy].name, String(r.days), r.days ? formatDecimal(r.average) : '–'])}
          />
        </section>

        <section className="panel panel--half" aria-labelledby="h-datti">
          <div className="panel__head">
            <h2 id="h-datti">Dattilografia</h2>
            <p>{view.typing.length ? `${view.typing.reduce((n, d) => n + d.runs, 0)} prove nel periodo.` : 'Nessuna prova nel periodo.'}</p>
          </div>
          <div className="pair">
            <div>
              <h3>Parole al minuto</h3>
              <LineChart
                points={view.typing.map((d) => ({ date: d.date, value: d.wpm, title: `${formatShort(d.date)}: ${Math.round(d.wpm)} parole al minuto` }))}
                days={range.days}
                format={(v) => String(Math.round(v))}
                label="Parole al minuto per giorno"
                minSpan={10}
              />
            </div>
            <div>
              <h3>Precisione</h3>
              <LineChart
                points={view.typing.map((d) => ({ date: d.date, value: d.accuracy * 100, title: `${formatShort(d.date)}: ${formatDecimal(d.accuracy * 100, 0)}%` }))}
                days={range.days}
                format={(v) => `${Math.round(v)}%`}
                label="Precisione per giorno"
                minSpan={10}
              />
            </div>
          </div>
        </section>

        <section className="panel panel--half" aria-labelledby="h-elsa">
          <div className="panel__head">
            <h2 id="h-elsa">Inglese con ELSA</h2>
            <p>{view.elsa.reduce((n, d) => n + d.minutes, 0)} minuti nel periodo.</p>
          </div>
          <div className="pair">
            <div>
              <h3>Minuti al giorno</h3>
              <Columns
                data={view.elsa.map((d) => ({ date: d.date, value: d.minutes, title: `${formatShort(d.date)}: ${d.minutes} minuti` }))}
                days={range.days}
                format={(v) => `${Math.round(v)} min`}
                label="Minuti di ELSA al giorno"
              />
            </div>
            <div>
              <h3>Punteggio</h3>
              <LineChart
                points={view.elsa.filter((d) => d.score !== undefined).map((d) => ({ date: d.date, value: d.score!, title: `${formatShort(d.date)}: ${d.score}` }))}
                days={range.days}
                format={(v) => String(Math.round(v))}
                label="Punteggio ELSA"
                minSpan={10}
              />
            </div>
          </div>
        </section>

        <section className="panel panel--future" aria-labelledby="h-orologio">
          <h2 id="h-orologio">Dati dell’orologio</h2>
          <p>Passi, sonno e battito arriveranno in una fase successiva, dal Redmi Watch attraverso Health Connect.</p>
        </section>
      </div>
    </Page>
  )
}
