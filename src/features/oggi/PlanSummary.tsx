import { navigate } from '../../app/router'
import { formatElapsed, startTimer, useActiveTimer, useElapsed } from '../../app/timer'
import { useI18n } from '../../i18n/store'
import type { RenderedItem } from '../../i18n/render'
import { itemDuration } from '../../rules/plan'

const OPENS_SECTION: Partial<Record<RenderedItem['kind'], 'ripasso' | 'dattilografia'>> = {
  ripasso: 'ripasso',
  dattilografia: 'dattilografia',
}

/** Il sommario del piano in quattro colonne numerate, ognuna avviabile. */
export function PlanSummary({ items, tierKey }: { items: RenderedItem[]; tierKey: string }) {
  const { f, t } = useI18n()
  const timer = useActiveTimer()
  const elapsed = useElapsed(timer?.startedAt)
  const shown = items.slice(0, 4)

  return (
    <section className="plan" aria-labelledby="plan-title">
      <h2 id="plan-title" className="sr-only">
        {t.oggi.planHeading}
      </h2>
      <ol className="plan__list" role="list">
          {shown.map((item, i) => {
            const running = timer?.key === item.key
            const section = OPENS_SECTION[item.kind]
            const action = section
              ? section === 'ripasso'
                ? t.oggi.openReview
                : t.oggi.openTyping
              : running
                ? t.oggi.stopSave
                : t.oggi.startTimer
            return (
              <li key={`${tierKey}:${item.key}`} className="plan__item swap-in" style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  className="plan__button"
                  aria-pressed={section ? undefined : running}
                  aria-label={t.oggi.planItemAria({ title: item.title, duration: itemDuration(item, f), detail: item.detail, action })}
                  onClick={() => {
                    if (section) navigate(section, item.courseId ? { materia: item.courseId } : undefined)
                    else void startTimer(item)
                  }}
                >
                  <span className="plan__n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="plan__body" aria-hidden="true">
                    <span className="plan__dur tnum">
                      {running ? t.oggi.running({ elapsed: formatElapsed(elapsed) }) : itemDuration(item, f)}
                    </span>
                    <span className="plan__title">{item.title}</span>
                    <span className="plan__detail">{item.detail}</span>
                    {running ? <span className="plan__cta">{t.oggi.tapToStop}</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
      </ol>
    </section>
  )
}
