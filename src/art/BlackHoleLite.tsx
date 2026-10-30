import { useSvgIds } from '../lib/useSvgIds'
import { BH, DISK_PATH } from './blackhole-geometry'

// Buco nero leggero per i cieli del Multiverso (fino a quattro sullo schermo):
// ombra, anello di fotoni e disco, con un bagliore a gradiente. Niente <filter>,
// niente animazioni, niente fusioni: al più otto elementi. Usa solo il colore del giorno.

const disk = { stopColor: 'var(--disk)' }
const GLOW_R = 300

/** Contenuto SVG (un <g>) da mettere dentro un cielo: centrato in (x, y) e scalato. */
export function BlackHoleLite({ x, y, scale, className }: { x: number; y: number; scale: number; className?: string }) {
  const ids = useSvgIds()
  return (
    <g className={className} transform={`translate(${x} ${y}) scale(${scale}) translate(${-BH.cx} ${-BH.cy}) rotate(${BH.tiltDeg} ${BH.cx} ${BH.cy})`}>
      <defs>
        <radialGradient id={ids.id('glow')} cx={BH.cx} cy={BH.cy} r={GLOW_R} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={disk} stopOpacity="0.5" />
          <stop offset="1" style={disk} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ids.id('dop')} x1={BH.cx - BH.diskRx} y1={BH.cy} x2={BH.cx + BH.diskRx} y2={BH.cy} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.22" style={disk} />
          <stop offset="0.62" style={disk} stopOpacity="0.6" />
          <stop offset="1" style={disk} stopOpacity="0.2" />
        </linearGradient>
        <clipPath id={ids.id('front')}>
          <rect x={BH.cx - 420} y={BH.cy} width={840} height={320} />
        </clipPath>
      </defs>
      <circle cx={BH.cx} cy={BH.cy} r={GLOW_R} fill={ids.url('glow')} />
      <path d={DISK_PATH} fill={ids.url('dop')} fillRule="evenodd" />
      <circle cx={BH.cx} cy={BH.cy} r={BH.shadow} fill="#000000" />
      <circle cx={BH.cx} cy={BH.cy} r={BH.ring} fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <path d={DISK_PATH} fill={ids.url('dop')} fillRule="evenodd" clipPath={ids.url('front')} />
    </g>
  )
}
