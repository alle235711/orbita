import { useMemo } from 'react'
import { mulberry32 } from '../lib/rng'

// Campo profondo di galassie lontane (SPEC §2, Statistiche): ellittiche
// dorate, spirali azzurre viste di sbieco, puntini rossi lontanissimi.
// Disegnato una volta con un seme, fermo.

const KINDS = [
  { id: 'ell', weight: 0.4 },
  { id: 'spi', weight: 0.4 },
  { id: 'red', weight: 0.2 },
] as const

export function DeepField({ className }: { className?: string }) {
  const galaxies = useMemo(() => {
    const r = mulberry32(1995) // l'anno dell'Hubble Deep Field
    return Array.from({ length: 150 }, () => {
      const roll = r()
      const kind = roll < KINDS[0].weight ? 'ell' : roll < KINDS[0].weight + KINDS[1].weight ? 'spi' : 'red'
      const size = kind === 'red' ? 0.8 + r() * 1.4 : 1.4 + r() ** 2.2 * 9
      return {
        kind,
        x: r() * 1200,
        y: r() * 900,
        rx: size,
        ry: size * (kind === 'spi' ? 0.25 + r() * 0.5 : 0.55 + r() * 0.45),
        rot: Math.round(r() * 180),
        o: 0.35 + r() * 0.5,
      }
    })
  }, [])

  return (
    <svg className={className} viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <radialGradient id="df-ell">
          <stop offset="0" stopColor="#FFF1D6" />
          <stop offset="0.35" stopColor="#FFD9A0" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFB870" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="df-spi">
          <stop offset="0" stopColor="#F2F5FF" />
          <stop offset="0.3" stopColor="#A9BEFF" stopOpacity="0.75" />
          <stop offset="1" stopColor="#7E98FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="df-red">
          <stop offset="0" stopColor="#FFB3A0" />
          <stop offset="1" stopColor="#E2604A" stopOpacity="0" />
        </radialGradient>
      </defs>
      {galaxies.map((g, i) => (
        <ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} fill={`url(#df-${g.kind})`} opacity={g.o} transform={`rotate(${g.rot} ${g.x} ${g.y})`} />
      ))}
    </svg>
  )
}
