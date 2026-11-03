import { expect, test, type Page } from '@playwright/test'
import { importDemo, isoDate, walkWizard } from './helpers'

// Controllo automatico delle sovrapposizioni, al posto degli screenshot da
// guardare a occhio: su ogni schermata, a 1180×820 e 390×844, sulla build di
// produzione,
// - il documento non scorre in orizzontale;
// - nessun elemento interattivo visibile è coperto da un altro (al centro
//   dell'elemento, elementFromPoint deve dare l'elemento o un suo discendente);
// - nessun testo esce dal suo contenitore in modo da tagliarsi (contenitore
//   con overflow nascosto, oppure pulsante o collegamento più stretto del
//   suo testo).

const VIEWPORTS = [
  { name: '1180x820', width: 1180, height: 820, mobile: false },
  { name: '390x844', width: 390, height: 844, mobile: true },
]

const SCREENS = [
  '#/oggi',
  '#/agenda',
  '#/agenda?vista=settimana',
  '#/briefing',
  '#/libretto',
  '#/multiverso',
  '#/regole',
  '#/statistiche',
  '#/ripasso?materia=demo-c-1',
  '#/ripasso?materia=demo-c-1&sezione=Parte%20B',
  '#/dattilografia',
  '#/dati',
  '#/dati?vista=latex&corso=demo-c-1&sezione=Parte%20B',
]

const now = new Date()
now.setHours(10, 20, 0, 0)
const today = isoDate(now)

interface Problems {
  scroll: string[]
  covered: string[]
  clipped: string[]
}

/** Esegue i tre controlli sulla schermata aperta, scorrendola dall'alto in basso. */
function inspect(page: Page): Promise<Problems> {
  return page.evaluate(async () => {
    const out = { scroll: [] as string[], covered: [] as string[], clipped: [] as string[] }
    const tol = 1
    // Coperture volute: le fasce orarie dell'Agenda stanno sotto i blocchi degli impegni (come nel mockup).
    const ALLOWED_UNDER: [string, string][] = [['.timeline__hour', '.block']]
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const describe = (el: Element) => {
      const text = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 50)
      const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : ''
      return `${el.tagName.toLowerCase()}${cls} «${text}»`
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return false
      const check = (el as HTMLElement).checkVisibility
      return check ? check.call(el, { opacityProperty: true, visibilityProperty: true }) : getComputedStyle(el).visibility !== 'hidden'
    }
    /**
     * Il primo tra l'elemento e i suoi antenati con overflow diverso da visible, se taglia (hidden o clip). Se il primo è
     * un contenitore che scorre (auto o scroll, come un carosello), il testo si raggiunge scorrendo:
     * non è tagliato.
     */
    const clipper = (el: Element): Element | null => {
      for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a)
        const kinds = [s.overflowX, s.overflowY]
        if (kinds.some((k) => k === 'auto' || k === 'scroll')) return null
        if (kinds.some((k) => k === 'hidden' || k === 'clip')) return a
      }
      return null
    }
    /** Il centro sta dentro ogni antenato che taglia o scorre: altrimenti è solo fuori vista. */
    const inClipView = (el: Element, x: number, y: number) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const s = getComputedStyle(a)
        if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
        const r = a.getBoundingClientRect()
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false
      }
      return true
    }

    // 1. scorrimento orizzontale del documento
    const doc = document.documentElement
    if (doc.scrollWidth > window.innerWidth + tol) out.scroll.push(`scrollWidth ${doc.scrollWidth} > ${window.innerWidth}`)

    // 2. elementi interattivi coperti, a ogni altezza della pagina
    const fixedRects = () =>
      [...document.querySelectorAll('body *')]
        .filter((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position) && visible(e))
        .map((e) => ({ el: e, r: e.getBoundingClientRect() }))
    const interactive = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=switch], [role=radio], [role=checkbox], [role=tab], [tabindex]:not([tabindex="-1"])'
    const seen = new Set<Element>()
    const height = Math.max(doc.scrollHeight, window.innerHeight)
    for (let y = 0; ; y += Math.floor(window.innerHeight * 0.7)) {
      window.scrollTo(0, y)
      await frame()
      const fixed = fixedRects()
      for (const el of document.querySelectorAll(interactive)) {
        if (seen.has(el) || !visible(el) || el.closest('[inert], [aria-hidden="true"]')) continue
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2
        const cy = r.top + r.height / 2
        if (x < 0 || x >= window.innerWidth || cy < 0 || cy >= window.innerHeight) continue
        if (!inClipView(el, x, cy)) continue
        // sotto una barra fissa mentre si scorre: lo si controlla a un'altra altezza
        if (fixed.some((f) => !f.el.contains(el) && x >= f.r.left && x <= f.r.right && cy >= f.r.top && cy <= f.r.bottom)) continue
        if (getComputedStyle(el).pointerEvents === 'none') continue
        seen.add(el)
        const hit = document.elementFromPoint(x, cy)
        if (!hit || hit === el || el.contains(hit)) continue
        const label = hit.closest('label')
        if (label && label.contains(el)) continue
        if (ALLOWED_UNDER.some(([under, over]) => el.matches(under) && hit.closest(over))) continue
        out.covered.push(`${describe(el)} coperto da ${describe(hit)}`)
      }
      if (y + window.innerHeight >= height) break
    }
    window.scrollTo(0, 0)

    // 3. testo tagliato
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    const reported = new Set<Element>()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const host = n.parentElement
      if (!host || !n.textContent?.trim() || reported.has(host) || host.closest('svg, [aria-hidden="true"], .sr-only, .katex-mathml, dialog:not([open])')) continue
      if (!visible(host)) continue
      range.selectNodeContents(n)
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5)
      if (!rects.length) continue
      // (a) un antenato con overflow nascosto taglia il testo (i puntini di sospensione sono voluti)
      const box = clipper(host)
      if (box) {
        const b = box.getBoundingClientRect()
        const ellipsis = getComputedStyle(host).textOverflow === 'ellipsis' || getComputedStyle(box).textOverflow === 'ellipsis'
        const tiny = b.width <= 2 || b.height <= 2
        // tutto fuori dal contenitore (una scheda di un carosello fuori vista) non è tagliato, è nascosto
        const inside = rects.some((r) => r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom)
        if (!ellipsis && !tiny && inside && rects.some((r) => r.left < b.left - tol || r.right > b.right + tol || r.top < b.top - tol || r.bottom > b.bottom + tol)) {
          reported.add(host)
          out.clipped.push(`${describe(host)} tagliato da ${describe(box)}`)
          continue
        }
      }
      // (b) il testo di un pulsante o di un collegamento esce dai suoi bordi
      const control = host.closest('button, a[href], summary, .chip, .btn')
      // se dentro il controllo un contenitore taglia il testo (con i puntini), vale il controllo (a)
      if (control && !(box && control.contains(box))) {
        const c = control.getBoundingClientRect()
        if (rects.some((r) => r.left < c.left - 2 || r.right > c.right + 2)) {
          reported.add(host)
          out.clipped.push(`${describe(host)} esce da ${describe(control)}`)
        }
      }
    }
    return out
  })
}

async function dismissNotice(page: Page) {
  // L'avviso "funziona anche senza rete" è passeggero e si chiude: non fa parte della schermata.
  const notice = page.locator('.update-toast button')
  await notice.first().waitFor({ timeout: 3000 }).catch(() => undefined)
  if (await notice.count()) await notice.first().click()
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.mobile, isMobile: vp.mobile, reducedMotion: 'reduce' })

    test('nessuna schermata scorre di lato, copre un controllo o taglia un testo', async ({ page }, testInfo) => {
      test.setTimeout(180_000)
      await page.clock.setFixedTime(now)
      await importDemo(page, testInfo, today)
      const report: string[] = []
      for (const hash of SCREENS) {
        await page.goto(`/${hash}`)
        await page.reload()
        await page.waitForLoadState('networkidle')
        await dismissNotice(page)
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(400)
        const p = await inspect(page)
        report.push(...[...p.scroll, ...p.covered, ...p.clipped].map((m) => `${hash}: ${m}`))
      }
      expect(report).toEqual([])
    })

    test('ripasso in LaTeX: resa sopra, Alt Gr e Shift sulla tastiera, nessuna sovrapposizione', async ({ page }, testInfo) => {
      test.setTimeout(120_000)
      await page.clock.setFixedTime(now)
      // Una scheda con formule inventata, già in scatola 2 e scaduta da dieci giorni: è la prima della coda.
      const source = 'E_n = -\\frac{13{,}6\\,\\mathrm{eV}}{n^2}'
      const dueOn = new Date(now)
      dueOn.setDate(dueOn.getDate() - 10)
      await importDemo(page, testInfo, today, {
        cards: [
          { id: 'demo-card-1-latex', courseId: 'demo-c-1', section: 'Parte B', kind: 'formula', title: 'Livelli in LaTeX', text: `I livelli dell’idrogeno valgono $${source}$ in elettronvolt.`, key: 'n^2', needsFix: false, userEdited: false, updatedAt: 1 },
        ],
        cardState: [{ id: 'demo-card-1-latex', box: 2, due: isoDate(dueOn), firstReviewed: isoDate(dueOn), lastReviewed: isoDate(dueOn), updatedAt: 1 }],
      })
      await page.goto('/#/ripasso?materia=demo-c-1')
      await page.reload()
      await dismissNotice(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Livelli in LaTeX' })).toBeVisible()
      await expect(page.locator('.ripasso__meta')).toContainText('Scatola 2 di 5, LaTeX')
      // la resa è il riferimento: HTML nascosto, MathML leggibile; sotto, il sorgente da battere
      const rendered = page.locator('.exercise__rendered')
      await expect(rendered.locator('.katex').first()).toBeVisible()
      await expect(rendered.locator('.katex-html').first()).toHaveAttribute('aria-hidden', 'true')
      await expect(rendered.locator('.katex-mathml math').first()).toBeAttached()
      await expect(page.locator('.exercise__text')).toHaveText(source)

      const typer = page.getByLabel('Batti il sorgente LaTeX della formula')
      await typer.click()
      await typer.pressSequentially('E_n = -\\frac')
      // il prossimo carattere è «{»: Alt Gr e Shift insieme, sul tasto di è
      await expect(page.locator('.exercise__hint')).toHaveText('«{», mignolo destro con Alt Gr (pollice destro) e lo Shift sinistro')
      if (!vp.mobile) {
        await expect(page.locator('.kbd__key--next')).toHaveText(/è/)
        await expect(page.locator('.kbd__key--shift')).toHaveCount(2)
        await expect(page.locator('.kbd__key--shift', { hasText: 'alt gr' })).toHaveCount(1)
      } else {
        await expect(page.locator('.kbd')).toHaveCount(0)
      }
      const p = await inspect(page)
      expect([...p.scroll, ...p.covered, ...p.clipped]).toEqual([])

      // si finisce di battere: scheda giusta, sale in scatola 3, e la revisione è salvata in modalità LaTeX
      await typer.pressSequentially(source.slice('E_n = -\\frac'.length))
      await expect(page.locator('.exercise__hint')).toContainText('Sale nella scatola 3')
      const review = await page.evaluate(
        () =>
          new Promise<{ mode: string; ok: boolean }[]>((resolve) => {
            const open = indexedDB.open('orbita')
            open.onsuccess = () => {
              const req = open.result.transaction('cardReviews').objectStore('cardReviews').index('cardId').getAll('demo-card-1-latex')
              req.onsuccess = () => {
                open.result.close()
                resolve(req.result)
              }
            }
          }),
      )
      expect(review.map((r) => [r.mode, r.ok])).toEqual([['latex', true]])
    })

    test('il convertitore mostra la resa KaTeX con MathML leggibile e HTML nascosto', async ({ page }, testInfo) => {
      await page.clock.setFixedTime(now)
      await importDemo(page, testInfo, today)
      await page.goto('/#/dati?vista=latex&corso=demo-c-1&sezione=Parte%20B')
      await page.reload()
      await dismissNotice(page)
      await expect(page.getByRole('heading', { level: 1, name: 'Converti in LaTeX' })).toBeVisible()
      const item = page.locator('.latex-item', { hasText: 'Lunghezza di de Broglie' })
      await expect(item.locator('.katex').first()).toBeVisible()
      await expect(item.locator('.katex-html').first()).toHaveAttribute('aria-hidden', 'true')
      await expect(item.locator('.katex-mathml math').first()).toBeAttached()
      // le schede già in LaTeX non hanno proposte
      await expect(page.locator('.latex-item', { hasText: 'Energia del fotone' })).toHaveCount(0)
      // conferma: la scheda esce dall'elenco e diventa modificata dall'utente
      await item.getByRole('button', { name: 'Converti questa scheda' }).click()
      await expect(page.locator('.latex__status')).toHaveText('Scheda convertita.')
      await expect(page.locator('.latex-item', { hasText: 'Lunghezza di de Broglie' })).toHaveCount(0)
      const card = await page.evaluate(
        () =>
          new Promise<{ text: string; userEdited: boolean }>((resolve) => {
            const open = indexedDB.open('orbita')
            open.onsuccess = () => {
              const req = open.result.transaction('cards').objectStore('cards').get('demo-card-1-f3')
              req.onsuccess = () => {
                open.result.close()
                resolve(req.result)
              }
            }
          }),
      )
      expect(card.userEdited).toBe(true)
      expect(card.text).toContain('$\\lambda = h / p$')
    })
  })
}

test('il controllo trova davvero scorrimento, coperture e testo tagliato', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await walkWizard(page, 1)
  await dismissNotice(page)
  await page.evaluate(() => {
    const button = document.querySelector('.welcome button')!.getBoundingClientRect()
    const cover = Object.assign(document.createElement('div'), { className: 'prova-copertura' })
    Object.assign(cover.style, { position: 'absolute', left: `${button.left}px`, top: `${button.top + window.scrollY}px`, width: `${button.width}px`, height: `${button.height}px`, zIndex: '50' })
    const wide = Object.assign(document.createElement('div'), { className: 'prova-larga' })
    Object.assign(wide.style, { width: '900px', height: '4px' })
    const box = Object.assign(document.createElement('p'), { className: 'prova-tagliata', textContent: 'Un testo lunghissimo che non ci sta nella scatola' })
    Object.assign(box.style, { width: '80px', whiteSpace: 'nowrap', overflow: 'hidden' })
    document.body.append(cover, wide, box)
  })
  const p = await inspect(page)
  expect(p.scroll.length).toBe(1)
  expect(p.covered.some((m) => m.includes('prova-copertura'))).toBe(true)
  expect(p.clipped.some((m) => m.includes('prova-tagliata'))).toBe(true)
})

test.describe('percorso guidato', () => {
  for (const vp of VIEWPORTS) {
    test(`primo passo senza sovrapposizioni, ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await walkWizard(page, 1)
      await dismissNotice(page)
      const p = await inspect(page)
      expect([...p.scroll, ...p.covered, ...p.clipped]).toEqual([])
    })
  }
})
