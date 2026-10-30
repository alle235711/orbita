import type { SvgIds } from '../lib/useSvgIds'

// La cometa disegnata: coda, alone e testa. La usano la copertina (Cosmos) e il
// Multiverso. I gradienti (`tail`, `core`, `halo`) restano a chi la usa, nei suoi <defs>.

const TAIL_MIN = 0.5

/** Coda e nucleo, con la punta lontana dal buco lungo `angle`. */
export function Tail({ ids, width, length, angle }: { ids: SvgIds; width: number; length: number; angle: number }) {
  if (length <= TAIL_MIN) return null
  return (
    <g transform={`rotate(${angle})`}>
      <polygon points={`0,${-width} 1,0 0,${width}`} transform={`scale(${length} 1)`} fill={ids.url('tail')} />
      <polygon points={`0,${-width / 3} 1,0 0,${width / 3}`} transform={`scale(${length * 0.8} 1)`} fill={ids.url('core')} />
    </g>
  )
}

export interface CometGlyphProps {
  ids: SvgIds
  angle: number
  tail: number
  headRadius: number
  tailWidth: number
  /** Testa vuota con un punto al centro: l'esame si ripete (copertina). */
  periodic?: boolean
}

/** Il contenuto di una cometa nel suo riferimento (origine = testa). Chi la usa la sposta. */
export function CometGlyph({ ids, angle, tail, headRadius: h, tailWidth, periodic }: CometGlyphProps) {
  return (
    <>
      <Tail ids={ids} width={tailWidth} length={tail} angle={angle} />
      <circle r={h * 2.4} fill={ids.url('halo')} />
      {periodic ? (
        <>
          <circle r={h} fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle r={h * 0.35} fill="#FFFFFF" />
        </>
      ) : (
        <circle r={h} fill="#FFFFFF" opacity="0.95" />
      )}
    </>
  )
}
