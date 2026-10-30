import { useMemo } from 'react'
import type { Course, Deadline } from '../db/schema'
import type { ISODate } from '../lib/dates'
import { useI18n } from '../i18n/store'
import { useElementWidth } from '../lib/useElementWidth'
import { layoutRuler } from './ruler'
import './Ruler.css'

const ROW = 15

/** Righello del tempo fino alla laurea, con le scadenze reali. */
export function Ruler({ today, courses, deadlines }: { today: ISODate; courses: Course[]; deadlines: Deadline[] }) {
  const i18n = useI18n()
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const layout = useMemo(() => (width ? layoutRuler(today, courses, deadlines, width, i18n) : null), [today, courses, deadlines, width, i18n])
  const extra = layout ? (layout.rows - 1) * ROW : 0
  const lineY = 36 + extra
  const labelY = (row: number) => 24 + extra - row * ROW

  return (
    <div className="ruler" ref={ref}>
      {layout ? (
        <svg width={width} height={64 + extra} viewBox={`0 0 ${width} ${64 + extra}`} role="img" aria-label={layout.description}>
          <line x1="0" y1={lineY} x2={width} y2={lineY} stroke="#B9C7EE" strokeOpacity="0.4" strokeWidth="1.2" />
          <g stroke="#B9C7EE" strokeOpacity="0.4" strokeWidth="1.2">
            {layout.ticks.map((t) => (
              <line key={t.label + t.x} x1={t.x} y1={lineY - 4} x2={t.x} y2={lineY + 4} />
            ))}
          </g>
          <g className="ruler__months">
            {layout.ticks.map((t) => (
              <text key={t.label + t.x} x={t.x} y={lineY + 20}>
                {t.label}
              </text>
            ))}
          </g>
          {layout.marks.map((m, i) => {
            switch (m.kind) {
              case 'period':
                return (
                  <g key={i} className="ruler__period">
                    <rect x={m.x} y={lineY - 3} width={Math.max(6, m.x2 - m.x)} height="6" rx="3" />
                    <text x={m.labelX} y={labelY(m.row)}>
                      {m.label}
                    </text>
                  </g>
                )
              case 'group':
                return (
                  <g key={i} className="ruler__group">
                    <rect x={m.x + 4} y={lineY - 3} width={Math.max(6, m.x2 - m.x)} height="6" rx="3" />
                    <text x={m.labelX + 4} y={labelY(m.row)}>
                      {m.label}
                    </text>
                  </g>
                )
              case 'next':
                return (
                  <g key={i} className="ruler__next">
                    <circle cx={m.x} cy={lineY} r="5" />
                    <text x={m.labelX} y={labelY(m.row)}>
                      {m.label}
                    </text>
                  </g>
                )
              case 'exam':
                return <circle key={i} cx={m.x} cy={lineY} r="3.5" fill="#EEF1FA" />
              case 'laurea':
                return (
                  <g key={i} className="ruler__laurea">
                    <circle cx={m.x} cy={lineY} r="6" />
                    <text x={m.labelX} y={labelY(m.row)} textAnchor={m.anchor}>
                      {m.label}
                    </text>
                  </g>
                )
            }
          })}
        </svg>
      ) : null}
    </div>
  )
}
