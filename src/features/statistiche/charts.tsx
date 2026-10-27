// Grafici in SVG scritto a mano, nello stile del mockup Lavagna-Statistiche:
// segni sottili, un solo asse, testi nei colori del testo, il dettaglio di
// ogni segno nel suo <title> e i numeri tutti nella tabella sotto.

import type { ReactNode } from 'react'
import { formatDecimal, formatShort, type ISODate } from '../../lib/dates'
import { useElementWidth } from '../../lib/useElementWidth'

const h = (n: number) => `${formatDecimal(n)} h`

// ——— ore al giorno: lecca-lecca con la linea delle 8 ore ———

export interface LollipopDatum {
  date: ISODate
  value: number
  title: string
}

export function Lollipops({ data, today, target, height = 170 }: { data: LollipopDatum[]; today: ISODate; target: number; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const max = Math.max(target * 1.25, ...data.map((d) => d.value), 1)
  const top = 12
  const y = (v: number) => top + (height - top) * (1 - v / max)
  const slot = width / Math.max(1, data.length)
  const every = Math.max(1, Math.ceil(data.length / 7))
  return (
    <div ref={ref} className="chart">
      {width ? (
        <svg width={width} height={height + 22} viewBox={`0 0 ${width} ${height + 22}`} role="img" aria-label={`Ore al giorno, ${data.length} giorni, obiettivo ${h(target)}.`}>
          <line x1="0" x2={width} y1={height} y2={height} className="chart__axis" />
          <line x1="0" x2={width - 34} y1={y(target)} y2={y(target)} className="chart__target" />
          <text x={width} y={y(target) + 4} textAnchor="end" className="chart__target-label">
            {h(target)}
          </text>
          {data.map((d, i) => {
            const cx = slot * i + slot / 2
            const isToday = d.date === today
            const over = d.value >= target
            const tone = over ? 'chart__mark--on' : 'chart__mark--off'
            return (
              <g key={d.date} className={`lollipop ${tone}${isToday ? ' lollipop--today' : ''}`}>
                <title>{d.title}</title>
                <rect x={cx - slot / 2} y={0} width={slot} height={height} fill="transparent" />
                {d.value > 0 ? <line x1={cx} x2={cx} y1={height} y2={y(d.value) + 5} className="lollipop__stem" /> : null}
                <circle cx={cx} cy={y(d.value)} r={isToday ? 4 : 5} className="lollipop__dot" />
                {i % every === 0 || isToday ? (
                  <text x={cx} y={height + 17} textAnchor="middle" className={`chart__tick${isToday ? ' chart__tick--today' : ''}`}>
                    {isToday ? 'oggi' : Number(d.date.slice(8))}
                  </text>
                ) : null}
              </g>
            )
          })}
        </svg>
      ) : null}
    </div>
  )
}

// ——— barre sottili orizzontali ———

export interface BarDatum {
  id: string
  label: string
  value: number
  display: string
  highlight?: boolean
}

export function Bars({ data, max }: { data: BarDatum[]; max?: number }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="bars" role="list">
      {data.map((d) => (
        <li key={d.id} className={d.highlight ? 'bars__row bars__row--on' : 'bars__row'}>
          <span className="bars__label">{d.label}</span>
          <span className="bars__track" aria-hidden="true">
            <span className="bars__fill" style={{ width: `${Math.max(2, (d.value / top) * 100)}%` }} />
          </span>
          <span className="bars__value">{d.display}</span>
        </li>
      ))}
    </ul>
  )
}

// ——— strisce: un pallino per ogni allenamento ———

export interface StripRow {
  id: string
  label: string
  dates: ISODate[]
  summary: string
}

export function Strips({ rows, days }: { rows: StripRow[]; days: ISODate[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const index = new Map(days.map((d, i) => [d, i]))
  const slot = width / Math.max(1, days.length)
  return (
    <div className="strips">
      {rows.map((row) => (
        <div key={row.id} className="strips__row">
          <span className="strips__label">{row.label}</span>
          <div ref={row === rows[0] ? ref : undefined} className="strips__track">
            {width ? (
              <svg width={width} height="24" viewBox={`0 0 ${width} 24`} aria-hidden="true">
                <line x1="0" x2={width} y1="12" y2="12" className="chart__axis" />
                {row.dates.map((d, i) => (
                  <circle key={`${d}-${i}`} cx={slot * (index.get(d) ?? 0) + slot / 2} cy="12" r="5" className={`strips__dot strips__dot--${row.id}`}>
                    <title>{`${row.label}, ${formatShort(d)}`}</title>
                  </circle>
                ))}
              </svg>
            ) : null}
          </div>
          <span className="strips__value">{row.summary}</span>
        </div>
      ))}
    </div>
  )
}

// ——— linea con i punti, un solo asse ———

export interface LinePoint {
  date: ISODate
  value: number
  title: string
}

interface LineChartProps {
  points: LinePoint[]
  days: ISODate[]
  format: (v: number) => string
  label: string
  height?: number
  /** Margine minimo dell'asse, per non esagerare piccole variazioni. */
  minSpan?: number
  domain?: [number, number]
}

export function LineChart({ points, days, format, label, height = 120, minSpan = 1, domain }: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const index = new Map(days.map((d, i) => [d, i]))
  const values = points.map((p) => p.value)
  let [lo, hi] = domain ?? [Math.min(...values), Math.max(...values)]
  if (!domain && hi - lo < minSpan) {
    const mid = (hi + lo) / 2
    lo = mid - minSpan / 2
    hi = mid + minSpan / 2
  }
  const padL = 0
  const padR = 52
  const top = 12
  const bottom = height - 8
  const x = (d: ISODate) => padL + ((index.get(d) ?? 0) / Math.max(1, days.length - 1)) * (width - padL - padR)
  const y = (v: number) => top + (bottom - top) * (1 - (v - lo) / Math.max(1e-9, hi - lo))
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points.at(-1)
  return (
    <div ref={ref} className="chart">
      {width && points.length ? (
        <svg width={width} height={height + 20} viewBox={`0 0 ${width} ${height + 20}`} role="img" aria-label={label}>
          <line x1="0" x2={width - padR + 8} y1={y(hi)} y2={y(hi)} className="chart__grid" />
          <line x1="0" x2={width - padR + 8} y1={y(lo)} y2={y(lo)} className="chart__grid" />
          <text x={width} y={y(hi) + 4} textAnchor="end" className="chart__tick">
            {format(hi)}
          </text>
          <text x={width} y={y(lo) + 4} textAnchor="end" className="chart__tick">
            {format(lo)}
          </text>
          {points.length > 1 ? <path d={path} className="line__path" /> : null}
          {points.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={p === last ? 5 : 3} className={p === last ? 'line__end' : 'line__dot'}>
              <title>{p.title}</title>
            </circle>
          ))}
          <text x={0} y={height + 16} className="chart__tick">
            {formatShort(days[0]!)}
          </text>
          <text x={width - padR} y={height + 16} textAnchor="end" className="chart__tick">
            {formatShort(days.at(-1)!)}
          </text>
        </svg>
      ) : (
        <p className="chart__empty">{points.length ? '' : 'Nessun dato nel periodo.'}</p>
      )}
    </div>
  )
}

// ——— colonne sottili ———

export function Columns({ data, days, format, label, height = 90 }: { data: LinePoint[]; days: ISODate[]; format: (v: number) => string; label: string; height?: number }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const index = new Map(days.map((d, i) => [d, i]))
  const max = Math.max(1, ...data.map((d) => d.value))
  const slot = width / Math.max(1, days.length)
  const bw = Math.max(2, Math.min(8, slot - 3))
  return (
    <div ref={ref} className="chart">
      {width ? (
        <svg width={width} height={height + 20} viewBox={`0 0 ${width} ${height + 20}`} role="img" aria-label={label}>
          <line x1="0" x2={width} y1={height} y2={height} className="chart__axis" />
          {data
            .filter((d) => d.value > 0)
            .map((d) => {
              const bh = (d.value / max) * (height - 10)
              const cx = slot * (index.get(d.date) ?? 0) + slot / 2
              const r = Math.min(4, bw / 2)
              return (
                <path
                  key={d.date}
                  className="column"
                  d={`M${cx - bw / 2},${height} V${height - bh + r} Q${cx - bw / 2},${height - bh} ${cx - bw / 2 + r},${height - bh} H${cx + bw / 2 - r} Q${cx + bw / 2},${height - bh} ${cx + bw / 2},${height - bh + r} V${height} Z`}
                >
                  <title>{d.title}</title>
                </path>
              )
            })}
          <text x={width} y={12} textAnchor="end" className="chart__tick">
            {format(max)}
          </text>
          <text x={0} y={height + 16} className="chart__tick">
            {formatShort(days[0]!)}
          </text>
          <text x={width} y={height + 16} textAnchor="end" className="chart__tick">
            {formatShort(days.at(-1)!)}
          </text>
        </svg>
      ) : null}
    </div>
  )
}

/** La tabella con tutti i numeri, chiusa di predefinito. */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return null
  return (
    <details className="datatable">
      <summary>Vedi i dati</summary>
      <table>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={c} scope="col" className={i ? 'num' : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={j ? 'num tnum' : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
