import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { ENERGY, type Energy } from '../lib/energy'
import { useSvgIds } from '../lib/useSvgIds'
import { BH, BH_VIEW, DISK_PATH, INNER_PATH } from './blackhole-geometry'
import './BlackHole.css'

// Il buco nero della Copertina (SPEC §2), con la geometria del mockup in
// coordinate 1180×820: ombra, anello di fotoni, disco visto quasi di taglio
// con il lato in avvicinamento più luminoso, immagine del disco lontano
// piegata sopra l'ombra dalla lente, alone e getti da Quasar in su.
// Due livelli: sotto alone e getti, sfocati e fermi; sopra il disco, che
// ruota senza filtri così il ridisegno a ogni fotogramma resta leggero.

const disk = { stopColor: 'var(--disk)' }

/** Le tappe in cui il buco nero si compone: ogni livello compare alla sua, in ordine. */
export type BlackHoleStage = 0 | 1 | 2 | 3 | 4 | 5
const FULL: BlackHoleStage = 5
/** Quanto dopo il livello precedente compare il successivo, dentro un'unica tappa. */
const STAGGER_MS = 120

/**
 * `stage` compone il buco nero a livelli: 0 solo l'ombra, 1 anello di fotoni,
 * 2 alone, 3 disco di fondo e bagliore interno, 4 disco davanti, archi di lente
 * e striature, 5 getti (se il livello li ha). Senza `stage` vale 5: il disegno
 * completo di sempre. Salendo di tappa i livelli nuovi compaiono in sequenza;
 * scendendo si spengono insieme. Con il movimento ridotto restano senza transizione.
 */
export function BlackHole({ level, className, stage, children }: { level: Energy; className?: string; stage?: BlackHoleStage; children?: ReactNode }) {
  const s = ENERGY[level]
  const current = stage ?? FULL
  const previous = useRef(current)
  // La tappa di partenza è quella dell'ultimo disegno confermato (non della prima passata di StrictMode).
  const from = previous.current
  useEffect(() => {
    previous.current = current
  })
  /** Opacità e ritardo di un livello della tappa `n`. */
  const lvl = (n: number, target: number): CSSProperties => ({
    opacity: current >= n ? target : 0,
    transitionDelay: current > from && n > from && n <= current ? `${(n - from - 1) * STAGGER_MS}ms` : '0ms',
  })
  const { id, url } = useSvgIds()

  return (
    <div className={`bh${className ? ` ${className}` : ''}`} aria-hidden="true" data-stage={current}>
      <svg className="bh__layer" viewBox={BH_VIEW} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={id('glow')} cx="925" cy="205" r="300" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={disk} stopOpacity="0.85" />
            <stop offset="0.45" style={disk} stopOpacity="0.32" />
            <stop offset="1" style={disk} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('jetUp')} x1="925" y1="205" x2="925" y2="-330" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.25" style={disk} stopOpacity="0.8" />
            <stop offset="1" style={disk} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={id('jetDn')} x1="925" y1="205" x2="925" y2="740" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.25" style={disk} stopOpacity="0.8" />
            <stop offset="1" style={disk} stopOpacity="0" />
          </linearGradient>
          <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="28" />
          </filter>
          <filter id={id('haze')} x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
        <g transform={`rotate(${BH.tiltDeg} ${BH.cx} ${BH.cy})`}>
          <circle className="bh__lvl" cx="925" cy="205" r="300" fill={url('glow')} filter={url('soft')} style={lvl(2, s.glow)} />
          <g className="bh__lvl" style={lvl(5, s.jet)}>
            <polygon points="921,205 929,205 952,-330 898,-330" fill={url('jetUp')} filter={url('haze')} />
            <polygon points="921,205 929,205 952,740 898,740" fill={url('jetDn')} filter={url('haze')} />
            <polygon points="923,205 927,205 932,-330 918,-330" fill="#FFFFFF" opacity="0.55" />
          </g>
        </g>
      </svg>

      <svg className="bh__layer bh__layer--disk" viewBox={BH_VIEW} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={id('dop')} x1="589" y1="205" x2="1261" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="0.22" style={disk} />
            <stop offset="0.62" style={disk} stopOpacity="0.6" />
            <stop offset="1" style={disk} stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id={id('lens')} x1="776" y1="205" x2="1074" y2="205" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="0.35" style={disk} stopOpacity="0.95" />
            <stop offset="1" style={disk} stopOpacity="0.35" />
          </linearGradient>
          <clipPath id={id('front')}>
            <rect x="500" y="205" width="850" height="320" />
          </clipPath>
        </defs>
        <g transform={`rotate(${BH.tiltDeg} ${BH.cx} ${BH.cy})`}>
          <g className="bh__lvl" style={lvl(3, s.disk)}>
            <path d={DISK_PATH} fill={url('dop')} fillRule="evenodd" />
            <path d={INNER_PATH} fill="#FFFFFF" fillOpacity="0.32" fillRule="evenodd" />
          </g>
          <g className="bh__lvl" style={lvl(4, s.disk)}>
            <ellipse className="bh__flow" cx="925" cy="205" rx="252" ry="38" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 31" strokeLinecap="round" />
            <path d="M776,205 A149,149 0 0,1 1074,205" fill="none" stroke={url('lens')} strokeWidth="40" strokeLinecap="round" />
          </g>
          <circle cx={BH.cx} cy={BH.cy} r={BH.shadow} fill="#000000" />
          <circle className="bh__lvl" cx={BH.cx} cy={BH.cy} r={BH.ring} fill="none" stroke="#FFFFFF" strokeWidth="2" style={lvl(1, s.ring)} />
          <g className="bh__lvl" style={lvl(4, s.disk)}>
            <path d="M799.6,205 A125.4,125.4 0 0,0 1050.4,205" fill="none" stroke={url('lens')} strokeWidth="7" />
            <g clipPath={url('front')}>
              <path d={DISK_PATH} fill={url('dop')} fillRule="evenodd" />
              <path d={INNER_PATH} fill="#FFFFFF" fillOpacity="0.32" fillRule="evenodd" />
              <ellipse className="bh__flow" cx="925" cy="205" rx="252" ry="38" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2" strokeDasharray="3 31" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </svg>
      {children ? (
        <svg className="bh__layer bh__layer--cosmos" viewBox={BH_VIEW} preserveAspectRatio="xMidYMid meet">
          {children}
        </svg>
      ) : null}
    </div>
  )
}

/** Il glifo del disco nei pulsanti dell'energia (44×16). */
export function DiskGlyph({ level, color }: { level: Energy; color: string }) {
  return (
    <svg width="44" height="16" viewBox="0 0 44 16" aria-hidden="true">
      <ellipse cx="22" cy="8" rx="20" ry="4.5" fill="none" stroke={color} strokeWidth={1 + level * 0.5} />
      <circle cx="22" cy="8" r="5.5" fill="#000000" stroke={color} strokeWidth="1" />
    </svg>
  )
}
