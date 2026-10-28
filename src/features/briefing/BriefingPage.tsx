import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { useToday } from '../../app/useToday'
import { Sky } from '../../art/Sky'
import { Ruler } from '../../components/Ruler'
import { db } from '../../db/db'
import { useDayPlan } from '../../db/plan-context'
import { alive } from '../../db/repo'
import type { Deadline } from '../../db/schema'
import { addDays, capitalize, diffDays, formatDate, formatLong, isBetween, isMonthOnly, relativeDays, resolveDate, toHHMM, withDate } from '../../lib/dates'
import { ENERGY } from '../../lib/energy'
import { priorityReason, weekStatus } from '../../rules/briefing'
import { itemDuration } from '../../rules/plan'
import { formatHours, WORK_TYPES } from '../../rules/rules'
import './BriefingPage.css'

export default function BriefingPage() {
  const today = useToday()
  const state = useDayPlan(today)
  const runs = useLiveQuery(() => db.typingRuns.where('date').between(addDays(today, -60), today, true, true).toArray().then(alive), [today])

  const status = useMemo(() => (state && runs ? weekStatus(state.context, runs) : null), [state, runs])
  if (!state || !status) return <Page className="briefing" />

  const { plan, context, now } = state
  const priorityHours = plan.priority
    ? context.sessions
        .filter((s) => s.courseId === plan.priority!.courseId && WORK_TYPES.includes(s.type) && isBetween(s.date, addDays(today, -6), today))
        .reduce((n, s) => n + s.minutes, 0) / 60
    : 0
  const upcoming = context.courses
    .filter((c) => c.examDate && diffDays(today, c.examDate) >= 0)
    .map((c): { id: string; title: string; date: string; days: number; end?: string } => ({ id: c.id, title: c.name, date: c.examDate!, days: diffDays(today, c.examDate!) }))
  const others = context.deadlines
    .filter((d): d is Deadline & { date: string } => !!d.date && diffDays(today, d.endDate ?? d.date) >= 0)
    .map((d) => ({ id: d.id, title: d.kind === 'laurea' ? `${d.title}${d.notes ? `, ${d.notes.toLowerCase()}` : ''}` : d.title, date: d.date, days: diffDays(today, d.date), end: d.endDate }))
  const milestones = [...upcoming, ...others].sort((a, b) => resolveDate(a.date).localeCompare(resolveDate(b.date))).slice(0, 7)

  const { sport, hours } = plan
  const deficit = Math.max(0, hours.target7 - hours.last7)
  const mainLabel = sport.main === 'arrampicata' ? 'arrampicate' : 'palestra'

  return (
    <Page className="briefing" labelledBy="titolo-briefing">
      <Sky nebula="briefing" />

      <header className="brief__head">
        <p className="brief__date">
          {capitalize(formatLong(today))}, calcolato alle {toHHMM(now)} su questo dispositivo, senza rete.
          {context.energy ? ` Disco da ${ENERGY[context.energy].name}.` : ''}
        </p>
        <h1 id="titolo-briefing" className="page__title">
          Briefing
        </h1>
      </header>

      <section className="brief__priority" aria-labelledby="h-prio">
        <h2 id="h-prio">
          {plan.priority ? (
            <>
              Oggi la priorità è
              <br />
              {plan.priority.name}
            </>
          ) : (
            'Nessun esame sotto la soglia'
          )}
        </h2>
        <p>{plan.priority ? priorityReason(plan, priorityHours) : 'Il piano segue l’esame più vicino e l’energia di oggi.'}</p>
        <ol className="brief__plan" role="list">
          {plan.items.slice(0, 4).map((item, i) => (
            <li key={item.key}>
              <span className="brief__plan-n">{i + 1}</span>
              <span>
                <strong>{item.title}</strong>, {itemDuration(item)}
              </span>
            </li>
          ))}
        </ol>
        <a className="btn btn--primary" href={href('oggi')}>
          Vai al piano
        </a>
      </section>

      <section className="brief__section" aria-labelledby="h-tappe">
        <h2 id="h-tappe">Verso la laurea</h2>
        <Ruler today={today} courses={context.courses} deadlines={context.deadlines} />
        <ul className="brief__milestones" role="list">
          {milestones.map((m) => (
            <li key={m.id}>
              <span className="brief__when">
                {m.end
                  ? `${withDate('dal', formatDate(m.date))} ${withDate('al', formatDate(m.end))}`
                  : isMonthOnly(m.date)
                    ? formatDate(m.date)
                    : `${formatDate(m.date)}, ${relativeDays(m.days)}`}
              </span>
              <span className="brief__what">{m.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="brief__section" aria-labelledby="h-settimana">
        <h2 id="h-settimana">La settimana</h2>
        <dl className="week-status">
          <div>
            <dt>Ore negli ultimi 7 giorni</dt>
            <dd className="week-status__value">
              {formatHours(hours.last7)} <span>di {formatHours(hours.target7)}</span>
            </dd>
            <dd>
              {deficit > 0
                ? `${formatHours(deficit)} sotto il ritmo di ${formatHours(hours.hoursPerDay)} al giorno: domani l’obiettivo è ${formatHours(hours.tomorrow)}.`
                : 'In pari con il ritmo della settimana.'}
            </dd>
          </div>
          <div>
            <dt>Sport</dt>
            <dd className="week-status__value">
              {sport.mainDone}/{sport.mainTarget} <span>{mainLabel}, {sport.runsDone}/{sport.runsTarget} corse</span>
            </dd>
            <dd>{plan.notes.find((n) => n.ruleId === 'sport')?.text ?? 'Obiettivi della settimana raggiunti.'}</dd>
          </div>
          <div>
            <dt>Lean 4</dt>
            <dd className="week-status__value">
              {Number.isFinite(plan.leanGap) ? (plan.leanGap === 0 ? 'Oggi' : `${plan.leanGap} g`) : 'Mai'} <span>{plan.leanGap === 0 ? 'già fatto' : 'dall’ultima sessione'}</span>
            </dd>
            <dd>{plan.notes.find((n) => n.ruleId === 'lean')?.text ?? 'Dentro la soglia.'}</dd>
          </div>
          <div>
            <dt>Inglese con ELSA</dt>
            <dd className="week-status__value">
              {status.english.streak} g <span>di fila</span>
            </dd>
            <dd>
              {status.english.minutes7} minuti questa settimana
              {status.english.lastScore !== undefined ? `, ultimo punteggio ${status.english.lastScore}` : ''}
              {status.english.scoreChange ? ` (${status.english.scoreChange > 0 ? '+' : ''}${status.english.scoreChange} in due settimane)` : ''}.
            </dd>
          </div>
          <div>
            <dt>Dattilografia</dt>
            <dd className="week-status__value">
              {status.typing.lastWpm ?? '–'} <span>parole al minuto</span>
            </dd>
            <dd>
              {status.typing.bestWpm
                ? `Record ${status.typing.bestWpm}${status.typing.daysSinceBest ? `, fermo da ${status.typing.daysSinceBest} giorni` : ', appena battuto'}. ${status.typing.runs7} ${status.typing.runs7 === 1 ? 'prova' : 'prove'} in settimana.`
                : 'Nessuna prova ancora: la prima lezione è la riga di base.'}
            </dd>
          </div>
        </dl>
      </section>

      <div className="brief__columns">
        <section className="brief__section" aria-labelledby="h-regole">
          <h2 id="h-regole">Le regole di oggi</h2>
          {plan.notes.length ? (
            <ul className="notes" role="list">
              {plan.notes.map((n, i) => (
                <li key={`${n.ruleId}-${i}`} className={`note note--${n.level}`}>
                  <strong>{n.title}</strong>
                  <span>{n.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brief__muted">Nessuna regola è scattata oggi.</p>
          )}
          <a className="btn" href={href('regole')}>
            Modifica le regole
          </a>
        </section>

        <section className="brief__section" aria-labelledby="h-domani">
          <h2 id="h-domani">Domani</h2>
          <p className="brief__muted">
            Obiettivo di {formatHours(hours.tomorrow)}
            {plan.tirocinio ? ', ancora in tirocinio' : ''}.
          </p>
          {plan.tomorrow.length ? (
            <ul className="notes" role="list">
              {plan.tomorrow.map((item) => (
                <li key={item.key} className="note">
                  <strong>
                    {item.title}, {itemDuration(item)}
                  </strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brief__muted">Niente da aggiungere per ora: il piano di domani si calcola domattina.</p>
          )}
        </section>
      </div>
    </Page>
  )
}
