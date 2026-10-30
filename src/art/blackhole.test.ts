import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BlackHole, type BlackHoleStage } from './BlackHole'

/** Le opacità dei livelli, nell'ordine in cui compaiono nel disegno. */
function levels(stage?: BlackHoleStage, level: 1 | 2 | 3 | 4 | 5 = 5): number[] {
  const html = renderToStaticMarkup(createElement(BlackHole, { level, stage }))
  return [...html.matchAll(/class="bh__lvl"[^>]*?style="opacity:([\d.]+)/g)].map((m) => Number(m[1]))
}

describe('BlackHole a tappe', () => {
  it('senza tappa è il disegno completo e dichiara tappa 5', () => {
    const html = renderToStaticMarkup(createElement(BlackHole, { level: 5 }))
    expect(html).toContain('data-stage="5"')
    expect(levels(undefined).every((o) => o > 0)).toBe(true)
    expect(levels(undefined)).toEqual(levels(5))
  })

  it('tappa 0: solo l’ombra, nessun livello acceso', () => {
    expect(levels(0).every((o) => o === 0)).toBe(true)
    expect(renderToStaticMarkup(createElement(BlackHole, { level: 3, stage: 0 }))).toContain('data-stage="0"')
  })

  it('i livelli si accendono in ordine: più tappe, più livelli visibili', () => {
    const lit = ([0, 1, 2, 3, 4, 5] as const).map((s) => levels(s).filter((o) => o > 0).length)
    for (let i = 1; i < lit.length; i++) expect(lit[i]!).toBeGreaterThanOrEqual(lit[i - 1]!)
    expect(lit[0]).toBe(0)
    expect(lit[5]).toBeGreaterThan(lit[4]!)
  })

  it('i getti compaiono solo alla tappa 5 e solo se il livello li ha', () => {
    expect(levels(4, 5).filter((o) => o > 0).length).toBe(levels(5, 5).filter((o) => o > 0).length - 1)
    expect(levels(5, 1).filter((o) => o > 0).length).toBe(levels(4, 1).filter((o) => o > 0).length)
  })
})
