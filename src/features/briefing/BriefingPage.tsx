import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { Page } from '../../app/Page'
import { href } from '../../app/router'
import { useToday } from '../../app/useToday'
import { Sky } from '../../art/Sky'
import { Ruler } from '../../components/Ruler'
import { db } from '../../db/db'
import { setSetting } from '../../db/settings'
import { useDayPlan } from '../../db/plan-context'
import { alive } from '../../db/repo'
import type { Deadline } from '../../db/schema'
import { addDays, diffDays, isBetween, resolveDate, toHHMM } from '../../lib/dates'
import { briefingTiles, moduleLabel } from '../../modules/registry'
import { normalizeStudyBlock } from '../../modules/types'
import { blockHint } from '../../rules/blocks'
import { priorityReason, weekStatus } from '../../rules/briefing'
import { itemDuration } from '../../rules/plan'
import { WORK_TYPES, examsAhead } from '../../rules/rules'
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
  const upcoming = examsAhead(context.courses, today).map(
    (e): { id: string; title: string; date: string; days: number; end?: string } => ({ id: e.course.id, title: e.course.name, date: e.course.examDate!, days: e.days }),
  )
  const others = context.deadlines
    .filter((d): d is Deadline & { date: string } => !!d.date && diffDays(today, d.endDate ?? d.date) >= 0)
    .map((d) => ({ id: d.id, title: d.title, date: d.date, days: diffDays(today, d.date), end: d.endDate }))
  const milestones = [...upcoming, ...others].sort((a, b) => resolveDate(a.date).localeCompare(resolveDate(b.date))).slice(0, 7)

  const { sport, hours } = plan
  const tiles = briefingTiles(context.modules)
  const sportParts = sport.types.filter((x) => x.target > 0)
  const sportDone = sportParts.reduce((n, x) => n + x.done, 0)
  const sportTarget = sportParts.reduce((n, x) => n + x.target, 0)
  const hint = blockHint(context.sessions, today, context.studyBlock)
  const applyHint = () => {
    if (hint) void setSetting(db, 'studyBlock', normalizeStudyBlock({ ...context.studyBlock, preset: hint.to }))
  }
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
          {tiles.has('sport') ? (
            <div>
              <dt>{tb.sport}</dt>
              <dd className="week-status__value">
                {sportDone}/{sportTarget} <span>{tb.sportSummary({ parts: sportParts })}</span>
              </dd>
              <dd>{plan.notes.find((n) => n.ruleId === 'sport')?.text ?? tb.sportGoalsReached}</dd>
            </div>
          ) : null}
          {tiles.has('ability') ? (
          <div>
            <dt>{tb.abilityTitle({ name: moduleLabel(context.modules, 'abilita', t) })}</dt>
            <dd className="week-status__value">
              {Number.isFinite(plan.abilityGap) ? (plan.abilityGap === 0 ? tb.abilityToday : tb.abilityDays({ n: plan.abilityGap })) : tb.abilityNever} <span>{plan.abilityGap === 0 ? tb.abilityDone : tb.abilitySince}</span>
            </dd>
            <dd>{plan.notes.find((n) => n.ruleId === 'abilita')?.text ?? tb.abilityWithin}</dd>
          </div>
          ) : null}
          {tiles.has('language') ? (
          <div>
            <dt>{tb.languageTitle({ name: moduleLabel(context.modules, 'lingua', t) })}</dt>
            <dd className="week-status__value">
              {tb.streak({ n: status.language.streak })} <span>{tb.streakSuffix}</span>
            </dd>
            <dd>
              {tb.languageDetail({ minutes: status.language.minutes7, lastScore: status.language.lastScore, change: status.language.scoreChange }, f)}
            </dd>
          </div>
          ) : null}
          {tiles.has('typing') ? (
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
          ) : null}
        </dl>
      </section>

      <div className="brief__columns">
        <section className="brief__section" aria-labelledby="h-regole">
          <h2 id="h-regole">{tb.todayRules}</h2>
          {hint ? (
            <div className="note note--hint" role="group" aria-label={t.blocks.hintTitle}>
              <span>{t.blocks.hint({ from: hint.from, to: hint.to, over: hint.over, total: hint.sessions }, f)}</span>
              <button type="button" className="btn" onClick={applyHint}>
                {t.blocks.use({ preset: hint.to })}
              </button>
            </div>
          ) : null}
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
            {plan.period ? tb.tomorrowPeriod : ''}.
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
