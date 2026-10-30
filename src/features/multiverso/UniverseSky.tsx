import { BlackHoleLite } from '../../art/BlackHoleLite'
import { CometGlyph } from '../../art/CometGlyph'
import { useSvgIds } from '../../lib/useSvgIds'
import { SKY_LAYOUT, type SkyLayout, type UniverseSky as Sky } from '../../multiverse/sky'

// Il cielo di un universo (viewBox 360x330): solo forme, decorativo (aria-hidden).
// Il testo equivalente sta nella scheda e nell'elenco per i lettori di schermo.
// Niente filtri, niente animazioni, niente fusioni: quattro cieli devono reggere su iPad.

const DASH = '3 4'

export function UniverseSky({ sky, layout = SKY_LAYOUT }: { sky: Sky; layout?: SkyLayout }) {
  const ids = useSvgIds()
  const { centre, comets: cl } = layout
  const disk = { stopColor: 'var(--disk)' }
  return (
    <svg className="uni__svg" viewBox={`0 0 ${layout.width} ${layout.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={ids.id('tail')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={disk} stopOpacity="0.85" />
          <stop offset="0.5" style={disk} stopOpacity="0.35" />
          <stop offset="1" style={disk} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.id('core')} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={ids.id('halo')}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>

      {sky.bands.map((b) => (
        <circle key={b.periodId} cx={centre.x} cy={centre.y} r={(b.rInner + b.rOuter) / 2} fill="none" stroke="var(--period)" strokeWidth={b.rOuter - b.rInner} strokeOpacity={b.conflict ? 0.2 : 0.08} data-band={b.periodId} />
      ))}

      <BlackHoleLite x={centre.x} y={centre.y} scale={layout.holeScale} />

      {sky.arcs.map((a) => (
        <path key={`${a.a}-${a.b}`} d={a.d} fill="none" stroke="var(--error)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={a.uncertain ? DASH : undefined} data-arc={`${a.a}:${a.b}`} />
      ))}

      {sky.comets.map((c) => (
        <g key={c.courseId} data-comet={c.courseId} transform={`translate(${c.x} ${c.y})`}>
          {c.range ? <line x1={c.range.x1 - c.x} y1={c.range.y1 - c.y} x2={c.range.x2 - c.x} y2={c.range.y2 - c.y} stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1" /> : null}
          <CometGlyph ids={ids} angle={c.angle} tail={c.tail} headRadius={c.headR} tailWidth={cl.tailWidth} />
          {c.monthOnly ? <circle r={c.headR + 2.5} fill="none" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="1" strokeDasharray={DASH} /> : null}
          {c.period ? <circle r={c.headR + 4} fill="none" stroke="var(--period)" strokeWidth="1.4" strokeDasharray={c.period === 'uncertain' ? DASH : undefined} /> : null}
        </g>
      ))}

      {sky.star ? (
        <g data-star="">
          {sky.star.range ? <line x1={sky.star.range.x1} y1={sky.star.range.y1} x2={sky.star.range.x2} y2={sky.star.range.y2} stroke="var(--cue)" strokeOpacity="0.7" strokeWidth="1" /> : null}
          <polygon
            points={sky.star.points}
            fill={sky.star.provisional ? 'none' : 'var(--cue)'}
            stroke="var(--cue)"
            strokeWidth={sky.star.provisional ? 1.2 : 0.8}
            strokeLinejoin="round"
            strokeDasharray={sky.star.provisional ? '2 2' : undefined}
          />
        </g>
      ) : null}
    </svg>
  )
}
