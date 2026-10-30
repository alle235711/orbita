// I numeri del buco nero in un posto solo, in coordinate 1180×820 del mockup.

export interface Point {
  x: number
  y: number
}

export const BH = {
  cx: 925,
  cy: 205,
  shadow: 112,
  ring: 116.5,
  diskRx: 336,
  diskRy: 51.5,
  innerRx: 168,
  innerRy: 25.8,
  haloRx: 218.4,
  haloRy: 33.6,
  tiltDeg: -9,
} as const

export const BH_VIEWBOX = { x: 520, y: -140, w: 780, h: 900 } as const
export const BH_VIEW = `${BH_VIEWBOX.x} ${BH_VIEWBOX.y} ${BH_VIEWBOX.w} ${BH_VIEWBOX.h}`
export const BH_CENTRE: Point = { x: BH.cx, y: BH.cy }
/** Centro del buco come frazione del viewBox. */
export const BH_ORIGIN_PCT = { x: (BH.cx - BH_VIEWBOX.x) / BH_VIEWBOX.w, y: (BH.cy - BH_VIEWBOX.y) / BH_VIEWBOX.h }

/** Forma decimale più corta, senza 706.6000000000001. */
const num = (x: number) => String(Number(x.toFixed(4)))

export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${num(cx - rx)},${num(cy)} a${num(rx)},${num(ry)} 0 1,0 ${num(2 * rx)},0 a${num(rx)},${num(ry)} 0 1,0 ${num(-2 * rx)},0 Z`
}

const HOLE = ellipsePath(BH.cx, BH.cy, BH.innerRx, BH.innerRy)
export const DISK_PATH = `${ellipsePath(BH.cx, BH.cy, BH.diskRx, BH.diskRy)} ${HOLE}`
export const INNER_PATH = `${ellipsePath(BH.cx, BH.cy, BH.haloRx, BH.haloRy)} ${HOLE}`
