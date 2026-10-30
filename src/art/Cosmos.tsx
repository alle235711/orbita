import { animate } from 'motion/react'
import { useEffect, useMemo, useRef } from 'react'
import { useSvgIds, type SvgIds } from '../lib/useSvgIds'
import { capturePath, captureFrame, orbitArc, polylineToPath, returnOrbit, hash01, type CaptureFrame, type CaptureSpec, type CosmosLayout, type Point } from './celestial'
import type { CaptureItem, CometItem, CosmosModel, MoonItem } from './cosmos-model'
import './Cosmos.css'

// Comete e lune, nel sistema di coordinate dell'SVG del buco nero (figlie di
// <BlackHole>): seguono la copertina su iPad e telefono. Puramente decorativo:
// il testo equivalente sta nelle liste per i lettori di schermo di Oggi.
// Niente <filter> (Safari) e niente mix-blend-mode (il buco è un contesto di impilamento).

export interface CosmosProps {
  model: CosmosModel
  layout: CosmosLayout
  /** Raggio, in unità del viewBox, dell'area che risponde al tocco su una testa (>= 44 px a schermo). */
  hitRadius: number
  /** Tocco su una cometa. */
  onCometTap?(courseId: string): void
  /** `prefers-reduced-motion`: la luna compare con una dissolvenza invece della spirale. */
  reduced?: boolean
  /** Secondi prima che parta una cattura (all'ingresso della copertina dopo la sua animazione). */
  startDelay?: number
  /** Chiamata una volta per cattura finita: è lì che la voce in sospeso si consuma. */
  onCaptured?(resultId: string): void
}

const CAPTURE_SECONDS = 2.6
const CAPTURE_STAGGER = 0.45
const CAPTURE_EASE: [number, number, number, number] = [0.3, 0, 0.2, 1]
const REDUCED_FADE_SECONDS = 0.3

const TAIL_MIN = 0.5
const ORBIT_LINE = '#B9C7EE'
const SWING_PERIOD_MIN = 50
const SWING_PERIOD_SPAN = 40

function Defs({ ids }: { ids: SvgIds }) {
  const disk = { stopColor: 'var(--disk)' }
  return (
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
      <radialGradient id={ids.id('moonBody')} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor="#EEF1FA" />
        <stop offset="0.55" stopColor="#9AA6C6" />
        <stop offset="1" stopColor="#4B5675" />
      </radialGradient>
      <radialGradient id={ids.id('lodeGlow')} r="1">
        <stop offset="0.62" style={disk} stopOpacity="0" />
        <stop offset="0.78" style={disk} stopOpacity="0.55" />
        <stop offset="1" style={disk} stopOpacity="0" />
      </radialGradient>
    </defs>
  )
}

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

function Comet({ c, ids, layout, hitRadius, onTap }: { c: CometItem; ids: SvgIds; layout: CosmosLayout; hitRadius: number; onTap?: (id: string) => void }) {
  const h = layout.comets.headRadius
  return (
    <g data-comet={c.courseId} data-periodic={c.periodic ? 'true' : undefined} transform={`translate(${c.x} ${c.y})`}>
      <Tail ids={ids} width={layout.comets.tailWidth} length={c.tail} angle={c.angle} />
      <circle r={h * 2.4} fill={ids.url('halo')} />
      {c.periodic ? (
        <>
          <circle r={h} fill="none" stroke="#FFFFFF" strokeWidth="1.6" />
          <circle r={h * 0.35} fill="#FFFFFF" />
        </>
      ) : (
        <circle r={h} fill="#FFFFFF" opacity="0.95" />
      )}
      {onTap ? <circle className="cosmos__hit" r={hitRadius} onClick={() => onTap(c.courseId)} /> : null}
    </g>
  )
}

/** Il corpo di una luna: bagliore e anello solo per la lode. */
export function MoonBody({ ids, radius, ring }: { ids: SvgIds; radius: number; ring: number | null }) {
  return (
    <>
      {ring !== null ? <circle r={ring + 8} fill={ids.url('lodeGlow')} /> : null}
      <circle r={radius} fill={ids.url('moonBody')} />
      {ring !== null ? <circle r={ring} fill="none" stroke="var(--disk)" strokeWidth="1.6" strokeOpacity="0.9" /> : null}
    </>
  )
}

/**
 * Una luna nel riferimento della sua orbita (un cerchio di raggio a diventa
 * l'ellisse a×b): oscilla piano lungo l'arco visibile e il corpo resta un
 * cerchio perché i due gruppi ruotano in verso opposto. L'oscillazione è SMIL
 * con il centro di rotazione esplicito, uguale in ogni browser; con il
 * movimento ridotto la luna sta ferma sulla sua fase.
 */
function Moon({ m, ids, layout, reduced, setRef }: { m: MoonItem; ids: SvgIds; layout: CosmosLayout; reduced: boolean; setRef?: (id: string, el: SVGGElement | null) => void }) {
  const l = layout.moons
  const period = SWING_PERIOD_MIN + SWING_PERIOD_SPAN * hash01(`${m.courseId}p`)
  const p0 = m.phase
  const p1 = m.phase + l.swingDeg
  const anim = (from: number, to: number) =>
    reduced ? null : (
      <animateTransform
        attributeName="transform"
        type="rotate"
        values={`${from} 0 0;${to} 0 0;${from} 0 0`}
        keyTimes="0;0.5;1"
        calcMode="spline"
        keySplines="0.45 0 0.55 1;0.45 0 0.55 1"
        dur={`${period * 2}s`}
        repeatCount="indefinite"
      />
    )
  return (
    <g
      ref={setRef ? (el) => setRef(m.courseId, el) : undefined}
      data-moon={m.courseId}
      data-lode={m.lode ? 'true' : undefined}
      data-pending={m.capturing ? 'true' : undefined}
      opacity={m.capturing ? 0 : undefined}
      transform={`translate(${l.centre.x} ${l.centre.y}) rotate(${l.tiltDeg}) scale(1 ${l.ratio})`}
    >
      <g transform={`rotate(${p0})`}>
        {anim(p0, p1)}
        <g transform={`translate(${m.a} 0)`}>
          <g transform={`rotate(${-p0})`}>
            {anim(-p0, -p1)}
            <g transform={`scale(1 ${1 / l.ratio})`}>
              <MoonBody ids={ids} radius={m.radius} ring={m.ring} />
            </g>
          </g>
        </g>
      </g>
    </g>
  )
}


interface SpriteRefs {
  g: SVGGElement | null
  tail: SVGGElement | null
  t1: SVGPolygonElement | null
  t2: SVGPolygonElement | null
  comet: SVGGElement | null
  head: SVGCircleElement | null
  moon: SVGGElement | null
  body: SVGCircleElement | null
  lode: SVGGElement | null
}
interface Capture {
  item: CaptureItem
  path: Point[]
  spec: CaptureSpec
}

/** Un fotogramma sulle parti del bozzolo, senza passare da React. */
function drawFrame(r: SpriteRefs, f: CaptureFrame): void {
  r.g?.setAttribute('transform', `translate(${f.x} ${f.y})`)
  const hidden = f.tail < TAIL_MIN
  r.tail?.setAttribute('display', hidden ? 'none' : 'inline')
  if (!hidden) {
    r.tail?.setAttribute('transform', `rotate(${f.angle})`)
    r.t1?.setAttribute('transform', `scale(${f.tail} 1)`)
    r.t2?.setAttribute('transform', `scale(${f.tail * 0.8} 1)`)
  }
  r.comet?.setAttribute('opacity', String(1 - f.mix))
  r.moon?.setAttribute('opacity', String(f.mix))
  r.head?.setAttribute('r', String(f.radius))
  r.body?.setAttribute('r', String(f.radius))
  r.lode?.setAttribute('opacity', String(f.ringOpacity))
}

/** La cometa che diventa luna: partenza esattamente dove stava la cometa. */
function CaptureSprite({ c, ids, layout, refs }: { c: Capture; ids: SvgIds; layout: CosmosLayout; refs: (el: SpriteRefs) => void }) {
  const f0 = captureFrame(c.path, 0, c.spec)
  const own = useRef<SpriteRefs>({ g: null, tail: null, t1: null, t2: null, comet: null, head: null, moon: null, body: null, lode: null })
  useEffect(() => refs(own.current))
  const w = layout.comets.tailWidth
  const m = c.item.moon
  return (
    <g data-capture={c.item.resultId} ref={(el) => void (own.current.g = el)} transform={`translate(${f0.x} ${f0.y})`}>
      <g ref={(el) => void (own.current.tail = el)} transform={`rotate(${f0.angle})`} display={f0.tail < TAIL_MIN ? 'none' : undefined}>
        <polygon ref={(el) => void (own.current.t1 = el)} points={`0,${-w} 1,0 0,${w}`} transform={`scale(${f0.tail} 1)`} fill={ids.url('tail')} />
        <polygon ref={(el) => void (own.current.t2 = el)} points={`0,${-w / 3} 1,0 0,${w / 3}`} transform={`scale(${f0.tail * 0.8} 1)`} fill={ids.url('core')} />
      </g>
      <g ref={(el) => void (own.current.comet = el)} opacity={1 - f0.mix}>
        <circle r={layout.comets.headRadius * 2.4} fill={ids.url('halo')} />
        <circle ref={(el) => void (own.current.head = el)} r={f0.radius} fill="#FFFFFF" opacity="0.95" />
      </g>
      <g ref={(el) => void (own.current.moon = el)} opacity={f0.mix}>
        {m.ring !== null ? (
          <g ref={(el) => void (own.current.lode = el)} opacity={f0.ringOpacity}>
            <circle r={m.ring + 8} fill={ids.url('lodeGlow')} />
            <circle r={m.ring} fill="none" stroke="var(--disk)" strokeWidth="1.6" strokeOpacity="0.9" />
          </g>
        ) : null}
        <circle ref={(el) => void (own.current.body = el)} r={f0.radius} fill={ids.url('moonBody')} />
      </g>
    </g>
  )
}

export function Cosmos({ model, layout, hitRadius, onCometTap, reduced = false, startDelay = 0.4, onCaptured }: CosmosProps) {
  const ids = useSvgIds()
  const l = layout.moons
  const lanes = [...new Set(model.moons.map((m) => m.lane))].sort((a, b) => a - b)

  const captureKey = model.captures.map((c) => c.resultId).join('|')
  const captures = useMemo<Capture[]>(
    () =>
      model.captures.map((item) => {
        const spec: CaptureSpec = {
          startTail: item.startTail,
          maxTail: layout.comets.maxTail,
          headRadius: layout.comets.headRadius,
          moonRadius: item.moon.radius,
          lode: item.moon.lode,
          centre: l.centre,
        }
        return { item, spec, path: capturePath(item.from, { x: item.moon.x, y: item.moon.y }, l.centre) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [captureKey, layout],
  )
  const live = useRef({ captures, onCaptured })
  live.current = { captures, onCaptured }
  const sprites = useRef(new Map<string, SpriteRefs>())
  const moonEls = useRef(new Map<string, SVGGElement>())

  useEffect(() => {
    const list = live.current.captures
    if (!list.length) return
    let cancelled = false
    const done = (id: string) => {
      if (!cancelled) live.current.onCaptured?.(id)
    }
    const controls = list.map((c, i) => {
      if (reduced) {
        const el = moonEls.current.get(c.item.courseId)
        return animate(0, 1, {
          duration: REDUCED_FADE_SECONDS,
          ease: 'easeOut',
          onUpdate: (v) => el?.setAttribute('opacity', String(v)),
          onComplete: () => done(c.item.resultId),
        })
      }
      return animate(0, 1, {
        duration: CAPTURE_SECONDS,
        delay: startDelay + i * CAPTURE_STAGGER,
        ease: CAPTURE_EASE,
        onUpdate: (t) => {
          const r = sprites.current.get(c.item.resultId)
          if (r) drawFrame(r, captureFrame(c.path, t, c.spec))
        },
        onComplete: () => done(c.item.resultId),
      })
    })
    return () => {
      cancelled = true
      controls.forEach((x) => x.stop())
    }
    // `captures` e il callback si leggono da un riferimento: l'effetto riparte solo se cambiano le catture o il modo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureKey, reduced, startDelay])

  return (
    <>
      <Defs ids={ids} />
      {lanes.map((lane) => {
        const a = l.lanes[lane]!
        return <path key={lane} d={orbitArc(l.centre, l.tiltDeg, a, a * l.ratio, l.arc[0], l.arc[1])} fill="none" stroke={ORBIT_LINE} strokeOpacity="0.14" strokeWidth="1" />
      })}
      {model.comets
        .filter((c) => c.periodic)
        .map((c) => (
          <path
            key={c.courseId}
            data-return={c.courseId}
            d={polylineToPath(returnOrbit(c, layout.comets))}
            fill="none"
            stroke="#EEF1FA"
            strokeOpacity="0.4"
            strokeWidth="1.2"
            strokeDasharray="3 6"
            strokeLinecap="round"
          />
        ))}
      {model.moons.map((m) => (
        <Moon
          key={m.courseId}
          m={m}
          ids={ids}
          layout={layout}
          reduced={reduced}
          setRef={(id, el) => {
            if (el) moonEls.current.set(id, el)
            else moonEls.current.delete(id)
          }}
        />
      ))}
      {model.comets.map((c) => (
        <Comet key={c.courseId} c={c} ids={ids} layout={layout} hitRadius={hitRadius} onTap={onCometTap} />
      ))}
      {reduced
        ? null
        : captures.map((c) => (
            <CaptureSprite
              key={c.item.resultId}
              c={c}
              ids={ids}
              layout={layout}
              refs={(el) => {
                sprites.current.set(c.item.resultId, el)
              }}
            />
          ))}
    </>
  )
}
