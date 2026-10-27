import { motion } from 'motion/react'
import { useId, useMemo } from 'react'
import { armGlow, galaxyArms } from '../features/agenda/agenda'
import { mulberry32 } from '../lib/rng'

const LETTERS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

interface SpiralGalaxyProps {
  /** Ore di ogni giorno, da lunedì a domenica. */
  hours: number[]
  /** Indice del giorno di oggi nella settimana mostrata (−1 se è un'altra settimana). */
  todayIndex: number
  selectedIndex: number
  onSelect?: (index: number) => void
  className?: string
}

/**
 * La galassia dell'Agenda (SPEC §2): vista di faccia, sette bracci che sono
 * i giorni della settimana. Più ore, più luce; oggi nel colore del disco.
 * All'apertura ruota una volta con una molla, poi sta ferma.
 */
export function SpiralGalaxy({ hours, todayIndex, selectedIndex, onSelect, className }: SpiralGalaxyProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const arms = useMemo(() => galaxyArms(150), [])
  // regioni HII e stelle giovani lungo i bracci, sempre le stesse
  const knots = useMemo(() => {
    const r = mulberry32(7)
    return Array.from({ length: 70 }, () => {
      const t = 0.25 + r() * 0.7
      const arm = Math.floor(r() * 7)
      const th = -Math.PI / 2 + (arm * 2 * Math.PI) / 7 + 2.1 * t + (r() - 0.5) * 0.18
      const rad = 150 * (0.12 + 0.88 * t) + (r() - 0.5) * 10
      return { x: rad * Math.cos(th), y: rad * Math.sin(th), r: 0.6 + r() * 1.4, pink: r() > 0.72, arm }
    })
  }, [])

  return (
    <svg className={className} viewBox="-190 -190 380 380" aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-core`}>
          <stop offset="0" stopColor="#FFF3D6" stopOpacity="0.95" />
          <stop offset="0.35" stopColor="#FFE7B0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFE7B0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-halo`}>
          <stop offset="0" stopColor="#9FB6FF" stopOpacity="0.22" />
          <stop offset="0.7" stopColor="#9FB6FF" stopOpacity="0.06" />
          <stop offset="1" stopColor="#9FB6FF" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-soft`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <circle r="185" fill={`url(#${uid}-halo)`} />
      <motion.g
        initial={{ rotate: -38 }}
        animate={{ rotate: 0 }}
        transition={{ type: 'spring', visualDuration: 1.6, bounce: 0.18 }}
        style={{ originX: '0px', originY: '0px' }}
      >
        {arms.map((arm) => {
          const isToday = arm.index === todayIndex
          const glow = armGlow(hours[arm.index] ?? 0)
          const color = isToday ? 'var(--disk)' : '#B9C7EE'
          return (
            <g key={arm.index} className="galaxy__arm" onClick={onSelect ? () => onSelect(arm.index) : undefined}>
              <path d={arm.ribbon} fill={color} opacity={(isToday ? 0.4 + glow * 0.4 : glow * 0.55)} filter={`url(#${uid}-soft)`} />
              <path d={arm.ribbon} fill={color} opacity={(isToday ? 0.3 + glow * 0.3 : glow * 0.35)} />
              <path d={arm.spine} fill="none" stroke={isToday ? 'var(--disk)' : '#DCE4FF'} strokeOpacity={glow} strokeWidth="1.3" strokeLinecap="round" />
              {arm.index === selectedIndex ? (
                <circle cx={arm.tip.x} cy={arm.tip.y} r="7" fill="none" stroke="#EEF1FA" strokeWidth="1.5" />
              ) : null}
            </g>
          )
        })}
        <g>
          {knots.map((k, i) => (
            <circle key={i} cx={k.x} cy={k.y} r={k.r} fill={k.pink ? '#FF7FB8' : '#EEF1FA'} opacity={k.pink ? 0.75 : 0.5 * armGlow(hours[k.arm] ?? 0)} />
          ))}
        </g>
        <circle r="46" fill={`url(#${uid}-core)`} />
        <ellipse rx="9" ry="7" fill="#FFF6E2" opacity="0.9" filter={`url(#${uid}-soft)`} />
      </motion.g>
      <g className="galaxy__letters">
        {arms.map((arm) => {
          // le lettere stanno ferme fuori dai bracci, dove i bracci finiscono
          const len = Math.hypot(arm.tip.x, arm.tip.y)
          const x = (arm.tip.x / len) * (len + 20)
          const y = (arm.tip.y / len) * (len + 20)
          return (
            <text key={arm.index} x={x} y={y + 4} textAnchor="middle" fontWeight={arm.index === selectedIndex ? 800 : 500} opacity={arm.index === selectedIndex ? 1 : 0.7}>
              {LETTERS[arm.index]}
            </text>
          )
        })}
      </g>
    </svg>
  )
}
