import { navigate } from '../../app/router'
import { formatElapsed, startTimer, useActiveTimer, useElapsed } from '../../app/timer'
import { itemDuration } from '../../rules/plan'
import type { PlanItem } from '../../rules/types'

const OPENS_SECTION: Partial<Record<PlanItem['kind'], 'ripasso' | 'dattilografia'>> = {
  ripasso: 'ripasso',
  dattilografia: 'dattilografia',
}

/** Il sommario del piano in quattro colonne numerate, ognuna avviabile. */
export function PlanSummary({ items, tierKey }: { items: PlanItem[]; tierKey: string }) {
  const timer = useActiveTimer()
  const elapsed = useElapsed(timer?.startedAt)
  const shown = items.slice(0, 4)

  return (
    <section className="plan" aria-labelledby="plan-title">
      <h2 id="plan-title" className="sr-only">
        Il piano di oggi
      </h2>
      <ol className="plan__list" role="list">
          {shown.map((item, i) => {
            const running = timer?.key === item.key
            const section = OPENS_SECTION[item.kind]
            const action = section
              ? `Apri ${section === 'ripasso' ? 'il ripasso' : 'la dattilografia'}`
              : running
                ? 'Ferma e salva'
                : 'Avvia il timer'
            return (
              <li key={`${tierKey}:${item.key}`} className="plan__item swap-in" style={{ animationDelay: `${i * 40}ms` }}>
                <button
                  type="button"
                  className="plan__button"
                  aria-pressed={section ? undefined : running}
                  aria-label={`${item.title}, ${itemDuration(item)}. ${item.detail} ${action}.`}
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
                      {running ? `In corso, ${formatElapsed(elapsed)}` : itemDuration(item)}
                    </span>
                    <span className="plan__title">{item.title}</span>
                    <span className="plan__detail">{item.detail}</span>
                    {running ? <span className="plan__cta">Tocca per fermare</span> : null}
                  </span>
                </button>
              </li>
            )
          })}
      </ol>
    </section>
  )
}
