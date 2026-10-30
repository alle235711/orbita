import { useSvgIds } from '../lib/useSvgIds'
import { FAR_GALAXY_KNOTS, FAR_GALAXY_PATH, STARS } from './cover-data'
import './Sky.css'

const BASE = import.meta.env.BASE_URL

/** Nebulosa pre-renderizzata (npm run gen:art) e campo di stelle. */
export function Sky({ nebula = 'oggi' }: { nebula?: 'oggi' | 'briefing' }) {
  return (
    <div className="sky" aria-hidden="true">
      <img className="sky__nebula" src={`${BASE}art/nebula-${nebula}.webp`} alt="" decoding="async" />
      <svg className="sky__stars" viewBox="0 0 1180 820" preserveAspectRatio="xMidYMid slice">
        <g fill="#EEF1FA">
          {STARS.map(([x, y, r, o], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={o} />
          ))}
        </g>
      </svg>
    </div>
  )
}

/** Leggera grana su tutta la pagina, da una tessera ripetuta. */
export function Grain() {
  return <div className="grain" aria-hidden="true" style={{ backgroundImage: `url(${BASE}art/grain.webp)` }} />
}

/** La piccola galassia a spirale lontana della Copertina. */
export function FarGalaxy({ className }: { className?: string }) {
  const ids = useSvgIds()
  return (
    <svg className={className} viewBox="1012 498 140 84" aria-hidden="true">
      <defs>
        <filter id={ids.id('haze')} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path d={FAR_GALAXY_PATH} fill="none" stroke="#9FB6FF" strokeOpacity="0.28" strokeWidth="9" strokeLinecap="round" filter={ids.url('haze')} />
      <path d={FAR_GALAXY_PATH} fill="none" stroke="#DCE4FF" strokeOpacity="0.6" strokeWidth="1.4" strokeLinecap="round" />
      <ellipse cx="1082" cy="540" rx="11" ry="6" transform="rotate(-28 1082 540)" fill="#FFE7B0" opacity="0.85" filter={ids.url('haze')} />
      <g fill="#FF7FB8" opacity="0.8">
        {FAR_GALAXY_KNOTS.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} />
        ))}
      </g>
    </svg>
  )
}
