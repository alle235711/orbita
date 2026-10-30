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
import { addDays, diffDays, isBetween, resolveDate, toHHMM } from '../../lib/dates'
import { priorityReason, weekStatus } from '../../rules/briefing'
import { itemDuration } from '../../rules/plan'
import { WORK_TYPES } from '../../rules/rules'
import { useI18n, useRenderedPlan } from '../../i18n/store'
import './BriefingPage.css'

export default function BriefingPage() {
  const today = useToday()
  const state = useDayPlan(today)
  const i18n = useI18n()
  const { f, t } = i18n
  const tb = t.briefing
  const plan = useRenderedPlan(state?.plan)
  const runs = useLiveQuery(() => db.typingRuns.where('date').between(addDays(today, -60), today, true, true).toArray().then(alive), [today])

  const status = useMemo(() => (state && runs ? weekStatus(state.context, runs) : null), [state, runs])
  if (!state || !status || !plan) return <Page className="briefing" />

  const { context, now } = state
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

  return (
    <Page className="briefing" labelledBy="titolo-briefing">
      <Sky nebula="briefing" />

      <header className="brief__head">
        <p className="brief__date">
          {tb.computedAt({ date: today, time: toHHMM(now) }, f)}
          {context.energy ? tb.disk({ energy: context.energy }) : ''}
        </p>
        <h1 id="titolo-briefing" className="page__title">
          {tb.title}
        </h1>
      </header>

      <section className="brief__priority" aria-labelledby="h-prio">
        <h2 id="h-prio">
          {plan.priority ? (
            <>
              {tb.priorityLead}
              <br />
              {plan.priority.name}
            </>
          ) : (
            tb.noPriority
          )}
        </h2>
        <p>{plan.priority ? priorityReason(state.plan, priorityHours, i18n) : tb.noPriorityText}</p>
        <ol className="brief__plan" role="list">
          {plan.items.slice(0, 4).map((item, i) => (
            <li key={item.key}>
              <span className="brief__plan-n">{i + 1}</span>
              <span>
                <strong>{item.title}</strong>, {itemDuration(item, f)}
              </span>
            </li>
          ))}
        </ol>
        <a className="btn btn--primary" href={href('oggi')}>
          {tb.goToPlan}
        </a>
      </section>

      <section className="brief__section" aria-labelledby="h-tappe">
        <h2 id="h-tappe">{tb.toGraduation}</h2>
        <Ruler today={today} courses={context.courses} deadlines={context.deadlines} />
        <ul className="brief__milestones" role="list">
          {milestones.map((m) => (
            <li key={m.id}>
              <span className="brief__when">
                {tb.when({ date: m.date, end: m.end, days: m.days }, f)}
              </span>
              <span className="brief__what">{m.title}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="brief__section" aria-labelledby="h-settimana">
        <h2 id="h-settimana">{tb.week}</h2>
        <dl className="week-status">
          <div>
            <dt>{tb.hoursLast7}</dt>
            <dd className="week-status__value">
              {f.hours(hours.last7)} <span>{tb.hoursOf({ target: hours.target7 }, f)}</span>
            </dd>
            <dd>
              {deficit > 0
                ? tb.hoursDeficit({ deficit, perDay: hours.hoursPerDay, tomorrow: hours.tomorrow }, f)
                : tb.hoursOnPace}
            </dd>
          </div>
          <div>
            <dt>{tb.sport}</dt>
            <dd className="week-status__value">
              {sport.mainDone}/{sport.mainTarget} <span>{tb.sportSummary({ main: sport.main === 'arrampicata' ? 'arrampicata' : 'palestra', runsDone: sport.runsDone, runsTarget: sport.runsTarget })}</span>
            </dd>
            <dd>{plan.notes.find((n) => n.ruleId === 'sport')?.text ?? tb.sportGoalsReached}</dd>
          </div>
          <div>
            <dt>{tb.abilityTitle}</dt>
            <dd className="week-status__value">
              {Number.isFinite(plan.leanGap) ? (plan.leanGap === 0 ? tb.abilityToday : tb.abilityDays({ n: plan.leanGap })) : tb.abilityNever} <span>{plan.leanGap === 0 ? tb.abilityDone : tb.abilitySince}</span>
            </dd>
            <dd>{plan.notes.find((n) => n.ruleId === 'lean')?.text ?? tb.abilityWithin}</dd>
          </div>
          <div>
            <dt>{tb.englishTitle}</dt>
            <dd className="week-status__value">
              {tb.streak({ n: status.english.streak })} <span>{tb.streakSuffix}</span>
            </dd>
            <dd>
              {tb.englishDetail({ minutes: status.english.minutes7, lastScore: status.english.lastScore, change: status.english.scoreChange }, f)}
            </dd>
          </div>
          <div>
            <dt>{tb.typingTitle}</dt>
            <dd className="week-status__value">
              {status.typing.lastWpm ?? '–'} <span>{tb.wpm}</span>
            </dd>
            <dd>
              {status.typing.bestWpm
                ? tb.typingRecord({ best: status.typing.bestWpm, daysSinceBest: status.typing.daysSinceBest, runs: status.typing.runs7 }, f)
                : tb.typingNone}
            </dd>
          </div>
        </dl>
      </section>

      <div className="brief__columns">
        <section className="brief__section" aria-labelledby="h-regole">
          <h2 id="h-regole">{tb.todayRules}</h2>
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
            <p className="brief__muted">{tb.noRules}</p>
          )}
          <a className="btn" href={href('regole')}>
            {tb.editRules}
          </a>
        </section>

        <section className="brief__section" aria-labelledby="h-domani">
          <h2 id="h-domani">{tb.tomorrow}</h2>
          <p className="brief__muted">
            {tb.tomorrowGoal({ hours: hours.tomorrow }, f)}
            {plan.tirocinio ? tb.tomorrowPeriod : ''}.
          </p>
          {plan.tomorrow.length ? (
            <ul className="notes" role="list">
              {plan.tomorrow.map((item) => (
                <li key={item.key} className="note">
                  <strong>
                    {item.title}, {itemDuration(item, f)}
                  </strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="brief__muted">{tb.tomorrowNothing}</p>
          )}
        </section>
      </div>
    </Page>
  )
}
