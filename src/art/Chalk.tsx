import type { CSSProperties, ReactNode } from 'react'
import { useT } from '../i18n/store'
import './Chalk.css'

// Disegni a gesso (SPEC §2): tratto sottile che si traccia da solo
// all'apertura con pathLength = 1 e stroke-dashoffset, poi resta fermo.
// Coordinate del mockup Rivista-Ripasso (pagina 1280×800).

const d = (delay: number): CSSProperties => ({ animationDelay: `${delay}s` })

function Line({ x1, y1, x2, y2, delay }: { x1: number; y1: number; x2: number; y2: number; delay: number }) {
  return <line className="ch" pathLength={1} x1={x1} y1={y1} x2={x2} y2={y2} style={d(delay)} />
}

function P({ d: path, delay, style }: { d: string; delay: number; style?: CSSProperties }) {
  return <path className="ch" pathLength={1} d={path} style={{ ...d(delay), ...style }} />
}

function T({ x, y, size, delay, children }: { x: number; y: number; size: number; delay: number; children: ReactNode }) {
  return (
    <text className="cht" x={x} y={y} fontSize={size} style={d(delay)}>
      {children}
    </text>
  )
}

/** Livelli dell'idrogeno. */
function Hydrogen() {
  return (
    <g>
      <line className="chd" x1="930" y1="92" x2="1236" y2="92" />
      <Line x1={930} y1={104} x2={1236} y2={104} delay={0.1} />
      <Line x1={930} y1={122} x2={1236} y2={122} delay={0.15} />
      <Line x1={930} y1={156} x2={1236} y2={156} delay={0.2} />
      <Line x1={930} y1={252} x2={1236} y2={252} delay={0.25} />
      <T x={1244} y={96} size={14} delay={1}>∞</T>
      <T x={1244} y={108} size={13} delay={1}>4</T>
      <T x={1244} y={126} size={13} delay={1}>3</T>
      <T x={1244} y={160} size={13} delay={1}>2</T>
      <T x={1240} y={256} size={13} delay={1}>n=1</T>
      <Line x1={966} y1={156} x2={966} y2={250} delay={0.6} />
      <P d="M961,242 L966,251 L971,242" delay={0.9} />
      <Line x1={1060} y1={122} x2={1060} y2={154} delay={0.7} />
      <P d="M1055,146 L1060,155 L1065,146" delay={1} />
      <Line x1={1100} y1={104} x2={1100} y2={154} delay={0.8} />
      <P d="M1095,146 L1100,155 L1105,146" delay={1.05} />
      <T x={974} y={214} size={15} delay={1.2}>Lyman α</T>
      <T x={1066} y={146} size={14} delay={1.25}>Hα</T>
      <T x={1106} y={134} size={14} delay={1.3}>Hβ</T>
      <T x={1004} y={286} size={19} delay={1.4}>Eₙ = −13,6 eV ⁄ n²</T>
    </g>
  )
}

/** Complesso di catene e toro. */
function ChainsAndTorus() {
  return (
    <g>
      <T x={928} y={104} size={22} delay={0.8}>⋯ → C₂ → C₁ → C₀ → 0</T>
      <T x={986} y={84} size={14} delay={0.9}>∂₂        ∂₁</T>
      <T x={944} y={140} size={17} delay={1}>Hₙ = ker ∂ₙ ⁄ im ∂ₙ₊₁</T>
      <ellipse className="ch" pathLength={1} cx="1090" cy="222" rx="104" ry="46" style={d(0.2)} />
      <P d="M1044,217 Q1090,240 1136,217" delay={0.5} />
      <P d="M1055,224 Q1090,209 1125,224" delay={0.6} />
      <ellipse className="chd" cx="1090" cy="223" rx="77" ry="30" />
      <ellipse className="chd" cx="1022" cy="225" rx="11" ry="24" />
      <T x={1084} y={187} size={16} delay={1.2}>a</T>
      <T x={998} y={230} size={16} delay={1.2}>b</T>
      <T x={1040} y={292} size={17} delay={1.3}>H₁(T²) ≅ ℤ ⊕ ℤ</T>
    </g>
  )
}

/** Diagramma di Hertzsprung-Russell. */
function HertzsprungRussell() {
  const art = useT().art
  return (
    <g>
      <P d="M950,84 L950,262 L1240,262" delay={0.1} />
      <P d="M968,96 C1010,120 1060,160 1110,196 C1150,224 1190,244 1228,254" delay={0.4} style={{ strokeWidth: 7, strokeOpacity: 0.18 }} />
      <P d="M1120,170 C1150,150 1180,126 1210,110" delay={0.7} style={{ strokeWidth: 6, strokeOpacity: 0.16 }} />
      <circle cx="1000" cy="232" r="2.5" fill="#B9C7EE" fillOpacity="0.45" />
      <circle cx="1012" cy="240" r="2.5" fill="#B9C7EE" fillOpacity="0.45" />
      <circle cx="990" cy="244" r="2.5" fill="#B9C7EE" fillOpacity="0.45" />
      <T x={932} y={96} size={17} delay={1}>L</T>
      <T x={1200} y={284} size={15} delay={1}>← T</T>
      <T x={1046} y={140} size={14} delay={1.1}>{art.mainSequence}</T>
      <T x={1172} y={100} size={14} delay={1.15}>{art.giants}</T>
      <T x={962} y={226} size={14} delay={1.2}>{art.whiteDwarfs}</T>
    </g>
  )
}

/** Le chiavi sono gli id dei mazzi d'esempio del file incluso. */
const DRAWINGS: Record<string, () => ReactNode> = {
  sdm: Hydrogen,
  topalg: ChainsAndTorus,
  astrost: HertzsprungRussell,
}

/** Il disegno del mazzo d'esempio del corso (`sampleDeck ?? id`); senza un disegno corrispondente resta la lavagna vuota. */
export function SubjectChalk({ deckId, className }: { deckId: string; className?: string }) {
  const Drawing = DRAWINGS[deckId]
  if (!Drawing) return null
  return (
    <svg key={deckId} className={`chalk ${className ?? ''}`} viewBox="900 60 380 250" aria-hidden="true">
      <Drawing />
    </svg>
  )
}
