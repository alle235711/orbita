import { SKY_LAYOUT, starPoints, type SkyLayout, type SkyStrip } from '../../multiverse/sky'

const TICK_H = 5
const STAR_R = 4

/** La striscia sotto il cielo: CFU per settimana, con gli esami, i periodi e la laurea. Decorativa. */
export function LoadStrip({ strip, layout = SKY_LAYOUT }: { strip: SkyStrip; layout?: SkyLayout }) {
  const { width, height, padY } = layout.strip
  const base = height - padY
  return (
    <svg className="uni__strip" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      {strip.bands.map((b) => (
        <rect key={b.periodId} x={b.x} y={padY} width={b.w} height={base - padY} fill="var(--period)" fillOpacity={b.conflict ? 0.22 : 0.1} />
      ))}
      <line x1={layout.strip.padX} y1={base} x2={width - layout.strip.padX} y2={base} stroke="var(--line-2)" strokeWidth="1" />
      {strip.area ? <path d={strip.area} fill="var(--disk)" fillOpacity="0.12" /> : null}
      {strip.curve ? <path d={strip.curve} fill="none" stroke="var(--disk)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /> : null}
      {strip.exams.map((e) => (
        <line key={e.courseId} x1={e.x} y1={base - TICK_H} x2={e.x} y2={base + 2} stroke="#FFFFFF" strokeOpacity="0.85" strokeWidth="1.4" strokeLinecap="round" />
      ))}
      {strip.peak ? <circle cx={strip.peak.x} cy={strip.peak.y} r="2.6" fill="#FFFFFF" /> : null}
      {strip.star ? <polygon points={starPoints(strip.star.x, base - 1, STAR_R)} fill="var(--cue)" /> : null}
    </svg>
  )
}
