import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Page } from '../../app/Page'
import { TopbarActions } from '../../app/TopbarActions'
import { useToday } from '../../app/useToday'
import { BlackHole } from '../../art/BlackHole'
import { FarGalaxy, Grain, Sky } from '../../art/Sky'
import { EnergyPicker } from '../../components/EnergyPicker'
import { QuickLog } from '../../components/QuickLog'
import { Ruler } from '../../components/Ruler'
import { setEnergy } from '../../db/actions'
import { useDay } from '../../db/hooks'
import { useDayPlan } from '../../db/plan-context'
import { renderMsg } from '../../i18n/messages'
import { useI18n, useRenderedPlan } from '../../i18n/store'
import { toMinutes } from '../../lib/dates'
import { DEFAULT_ENERGY } from '../../lib/energy'
import { useElementWidth } from '../../lib/useElementWidth'
import { scheduleDay } from '../../rules/schedule'
import { OrbitArcs, OrbitPlanets } from './DayOrbit'
import { DAY_END, type Mapping, type PlanetInput } from './orbit'
import { PlanSummary } from './PlanSummary'
import './OggiPage.css'

// L'ingresso orchestrato (buco nero che sale, titolo, arco che si traccia)
// si vede alla prima apertura; tornando su Oggi la copertina è già ferma.
let introPlayed = false

const WIDE = 860

/** Etichette brevi sul telefono: la prima parola basta a riconoscere l'impegno. */
const shorten = (title: string, narrow: boolean) => (narrow && title.length > 14 ? title.split(/\s+/)[0]! : title)

export default function OggiPage() {
  const today = useToday()
  const day = useDay(today)
  const state = useDayPlan(today)
  const i18n = useI18n()
  const to = i18n.t.oggi
  const [logOpen, setLogOpen] = useState(false)
  const [intro] = useState(() => !introPlayed)
  const [coverRef, width] = useElementWidth<HTMLDivElement>()

  useEffect(() => {
    introPlayed = true
  }, [])

  const wide = width >= WIDE
  const u = wide ? Math.min(1, width / 1180) : 1
  const energy = day?.energy ?? DEFAULT_ENERGY
  const plan = useRenderedPlan(state?.plan)

  // Coordinate del mockup → pixel. Sul telefono l'orbita si allunga in
  // verticale per lasciare posto alle etichette.
  const orbit = useMemo(() => {
    if (!width) return null
    if (wide) {
      const mapping: Mapping = { sx: width / 1180, sy: u, y0: 90 }
      return { mapping, height: 510 * u, font: 13 }
    }
    const sx = width / 1180
    const mapping: Mapping = { sx, sy: Math.min(1, sx * 2.3), y0: 300 }
    return { mapping, height: 305 * mapping.sy, font: 12 }
  }, [width, wide, u])

  const suggestions = useMemo(() => {
    if (!state) return []
    return scheduleDay(state.plan.items, state.context.events, { from: state.now })
  }, [state])

  const planets = useMemo<PlanetInput[]>(() => {
    if (!state) return []
    const events: PlanetInput[] = state.context.events.map((e) => ({
      id: e.id,
      minutes: toMinutes(e.start),
      label: shorten(e.title, !wide),
      time: e.start,
      kind: 'event',
    }))
    // I suggerimenti fuori dall'arco (dopo le 19) restano in agenda, non qui.
    const blocks: PlanetInput[] = suggestions
      .filter((b) => b.part === 1 && toMinutes(b.start) <= DAY_END)
      .map((b) => ({ id: b.key, minutes: toMinutes(b.start), label: shorten(renderMsg(b.item.title, i18n), !wide), time: b.start, kind: 'suggestion' }))
    return [...events, ...blocks]
  }, [state, suggestions, wide, i18n])

  const style = { '--u': `${u}px` } as CSSProperties
  const dayNumber = Number(today.slice(8, 10))

  return (
    <Page className="oggi" labelledBy="oggi-title">
      <TopbarActions>
        <button type="button" className="btn log-button" onClick={() => setLogOpen(true)} aria-haspopup="dialog">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="log-button__label">{to.register}</span>
        </button>
      </TopbarActions>

      <div ref={coverRef} className={`cover${wide ? ' cover--wide' : ''}${intro ? ' cover--intro' : ''}`} style={style}>
        <Sky />
        <BlackHole level={energy} className={`cover__bh${intro ? ' bh--rise' : ''}`} />

        <h1 id="oggi-title" className="cover__title">
          {/* cambiando fascia il titolo si riaccende con una breve dissolvenza */}
          <span key={plan ? plan.tier : 'attesa'} className={`cover__title-text${plan && !intro ? ' swap-in' : ''}`}>
            {plan ? (
              <>
                {plan.headline[0]}
                <br />
                {plan.headline[1]}
              </>
            ) : (
              '\u00a0'
            )}
          </span>
        </h1>

        <p className="cover__rule">{plan?.rule ?? ' '}</p>

        <section className="cover__energy" aria-labelledby="energy-q">
          <h2 id="energy-q">{to.energyQuestion}</h2>
          <EnergyPicker value={day?.energy} onChange={(e) => void setEnergy(today, e)} labelledBy="energy-q" />
        </section>

        <div className="cover__spacer" />

        <div className="cover__lower">
          <div className="cover__orbit" style={{ height: wide || !orbit ? 0 : orbit.height }}>
            <span className="cover__day" aria-hidden="true">
              {dayNumber}
            </span>
            <FarGalaxy className={`cover__galaxy${intro ? ' cover__fade' : ''}`} />
            {orbit && state ? (
              <>
                <OrbitArcs mapping={orbit.mapping} width={width} height={orbit.height} now={state.now} intro={intro} />
                <OrbitPlanets
                  mapping={orbit.mapping}
                  width={width}
                  height={orbit.height}
                  now={state.now}
                  intro={intro}
                  planets={planets}
                  fontSize={orbit.font}
                />
              </>
            ) : null}
          </div>

          <div className="sr-only">
            <h2>{to.orbitHeading}</h2>
            {state?.context.events.length ? (
              <ul>
                {state.context.events.map((e) => (
                  <li key={e.id}>
                    {e.start}–{e.end}, {e.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{to.noEvents}</p>
            )}
            {suggestions.length ? (
              <p>{to.suggestedBlocks({ blocks: suggestions.map((b) => ({ start: b.start, title: renderMsg(b.item.title, i18n) })) })}</p>
            ) : null}
          </div>

          {plan ? <PlanSummary items={plan.items} tierKey={plan.tier} /> : <div className="plan plan--empty" />}

          {state ? <Ruler today={today} courses={state.context.courses} deadlines={state.context.deadlines} /> : null}
        </div>

        <Grain />
      </div>

      <QuickLog open={logOpen} onClose={() => setLogOpen(false)} courses={state?.context.courses ?? []} />
    </Page>
  )
}
