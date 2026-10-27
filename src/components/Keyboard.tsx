import type { CSSProperties } from 'react'
import { useElementWidth } from '../lib/useElementWidth'
import { ROWS, type Finger, type Stroke } from '../review/keyboard'
import './Keyboard.css'

const FINGER_VAR: Record<Finger, string> = {
  mignolo: 'var(--finger-pinky)',
  anulare: 'var(--finger-ring)',
  medio: 'var(--finger-middle)',
  indice: 'var(--finger-index)',
  pollice: 'var(--finger-thumb)',
}

const WIDTH = 840
const HEIGHT = 5 * 46 + 4 * 6

interface KeyboardProps {
  /** Il tasto successivo da illuminare, con lo Shift. Omettilo nelle modalità a memoria. */
  next?: Stroke | null
  /** Errori per tasto: nelle modalità a memoria le battute sbagliate, in Dattilografia la mappa di calore. */
  errors?: Record<string, number>
  /** Valore che accende al massimo un tasto nella mappa degli errori. */
  errorScale?: number
  label: string
}

/** La tastiera HP 250 G8 disegnata, coi colori delle dita sul bordo di ogni tasto. */
export function Keyboard({ next, errors, errorScale = 3, label }: KeyboardProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const scale = width ? Math.min(1, width / WIDTH) : 1

  return (
    <div className="kbd" ref={ref} role="img" aria-label={label} style={{ height: HEIGHT * scale }}>
      <div className="kbd__board" style={{ transform: `scale(${scale})`, width: WIDTH }}>
        {ROWS.map((row, r) => (
          <div key={r} className="kbd__row">
            {row.map((key) => {
              const isNext = next?.key.id === key.id
              const isShift = next?.shift?.id === key.id
              const err = errors?.[key.id] ?? 0
              const style = {
                width: key.width,
                '--finger': key.finger ? FINGER_VAR[key.finger] : 'var(--finger-none)',
                '--heat': Math.min(1, err / errorScale),
              } as CSSProperties
              const state = isNext ? ' kbd__key--next' : isShift ? ' kbd__key--shift' : err > 0 ? ' kbd__key--error' : ''
              return (
                <div key={key.id} className={`kbd__key${state}`} style={style}>
                  <span className="kbd__up">{key.up ?? ''}</span>
                  <span className="kbd__label">{key.label}</span>
                  {key.bump ? <span className="kbd__bump" /> : null}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export function FingerLegend() {
  const items: [Finger, string][] = [
    ['mignolo', 'mignoli'],
    ['anulare', 'anulari'],
    ['medio', 'medi'],
    ['indice', 'indici'],
    ['pollice', 'pollici'],
  ]
  return (
    <ul className="kbd-legend" role="list" aria-label="Colori delle dita">
      {items.map(([f, label]) => (
        <li key={f}>
          <span aria-hidden="true" style={{ background: FINGER_VAR[f] }} />
          {label}
        </li>
      ))}
    </ul>
  )
}
