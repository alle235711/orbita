import { useMemo } from 'react'
import { useT } from '../../i18n/store'
import { dayArcPath, fullOrbitPath, placePlanets, travelledPath, DAY_END, DAY_START, type Mapping, type PlanetInput } from './orbit'

interface OrbitProps {
  mapping: Mapping
  width: number
  height: number
  now: number
  intro: boolean
}

/** Livello sotto: l'orbita intera, l'arco del giorno e il tratto già percorso. */
export function OrbitArcs({ mapping, width, height, now, intro }: OrbitProps) {
  const paths = useMemo(
    () => ({ full: fullOrbitPath(mapping), day: dayArcPath(mapping), done: travelledPath(now, mapping) }),
    [mapping, now],
  )
  return (
    <svg className="orbit orbit--arcs" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={paths.full} fill="none" stroke="#B9C7EE" strokeOpacity="0.16" strokeWidth="1" />
      <path d={paths.day} fill="none" stroke="#EEF1FA" strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="2 7" strokeLinecap="round" />
      {paths.done ? (
        <path
          className={intro ? 'orbit__done orbit__done--draw' : 'orbit__done'}
          d={paths.done}
          pathLength={1}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}

/** Livello sopra, in fusione "difference": i pianeti e le loro etichette. */
export function OrbitPlanets({ mapping, width, height, now, intro, planets, fontSize }: OrbitProps & { planets: PlanetInput[]; fontSize: number }) {
  const nowLabel = useT().oggi.now
  const all = useMemo(() => {
    const list = [...planets]
    if (now >= DAY_START && now <= DAY_END) list.push({ id: 'adesso', minutes: now, label: nowLabel, time: '', kind: 'now' })
    return placePlanets(list, mapping, width, fontSize * 0.53, fontSize)
  }, [planets, now, mapping, width, fontSize, nowLabel])

  return (
    <svg className="orbit orbit--planets" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <g fill="#EEF1FA" fontSize={fontSize}>
        {all.map((p, i) =>
          p.kind === 'now' ? (
            <g key={p.id} className={intro ? 'orbit__fade' : undefined} style={{ animationDelay: '1.6s' }}>
              <circle cx={p.x} cy={p.y} r="9" />
              <circle cx={p.x} cy={p.y} r="18" fill="none" stroke="#EEF1FA" strokeOpacity="0.5" />
              <text x={p.labelX} y={p.labelY} fontSize={fontSize + 1} fontWeight="800" textAnchor={p.anchor}>
                {nowLabel}
              </text>
            </g>
          ) : (
            <g key={p.id} className={intro ? 'orbit__fade' : undefined} style={{ animationDelay: `${1.2 + i * 0.08}s` }}>
              {p.kind === 'suggestion' ? (
                <circle cx={p.x} cy={p.y} r="5.25" fill="none" stroke="#EEF1FA" strokeWidth="1.5" />
              ) : (
                <circle cx={p.x} cy={p.y} r="6" />
              )}
              <text x={p.labelX} y={p.labelY} textAnchor={p.anchor} opacity={p.kind === 'suggestion' ? 0.75 : 1}>
                <tspan fontWeight="800">{p.time}</tspan> {p.label}
              </text>
            </g>
          ),
        )}
      </g>
    </svg>
  )
}
